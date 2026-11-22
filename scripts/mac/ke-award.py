#!/usr/bin/env python3
"""대표 전용 · 대한항공 마일리지 좌석 수집기 (오피스 mileage/, 2026-11-22)

사장님 요청: "30분마다 자동으로 대한항공 마일리지로 예약 가능한 프레스티지, 일등석 가능한 나라 전부 캘린더로"
· 자료 = 대한항공 홈페이지 '보너스 좌석 상황 보기'(비로그인 공개 현황, 대한항공이 하루 1번 갱신).
  /api/hmp/bonusSeatView/bonusSeatView 에 노선 · 달을 보내면 날짜별 편마다 X(일반) · O(프레스티지) · Z(승급) · A(일등석) 가능 여부를 준다.
  O · A 만 오피스 저장소(Supabase 비드유니버스 ke_award_*)로 올린다. 로그인 · 예약 · 결제는 하지 않는다.
· 30분마다(launchd com.brightbeed.ke-award) 저장소가 고른 '가장 오래 안 본 노선 · 달' 40개만 읽는다(3~5초 간격).
  가까운 3달은 20시간, 그 뒤는 44시간, 운항 없는 노선은 30일마다 다시 본다 → 노선 212개 × 13달이 하루 이틀에 한 바퀴.
· 대한항공 클라우드 서버 차단(Akamai): 슈퍼베이스 · 깃허브 같은 클라우드 IP 는 403 이라 사무실 맥에서만 돈다.
  403 · 428 · 429 · 'Access Denied' 면 그 자리에서 멈추고 저장소에 알린다 → 1 · 2 · 4 … 최대 24시간 쉼.
  브라우저 흉내(UA 위장 · 쿠키 복사 · 캡차 풀기 · 프록시 돌리기)는 하지 않는다.
· 열쇠 = 이 맥 ~/.config/brightbeed/ke-award.key (처음 실행 때 만듦, 0600). 저장소엔 sha256 만.
  처음엔 '승인 대기' — 오피스 '관리자 전용 › 마일리지 캘린더' 화면에서 대표가 [승인] (또는 Claude 가 SQL 로).

python3 -I ke-award.py            # 한 번 돌기 (launchd 가 30분마다 부름)
python3 -I ke-award.py --limit 5  # 적게
python3 -I ke-award.py --status   # 저장소 상태만
"""
import argparse
import fcntl
import http.cookiejar
import json
import os
import random
import re
import secrets
import socket
import sys
import time
import urllib.error
import urllib.request
import uuid
from urllib.parse import unquote
from datetime import date, datetime, timedelta, timezone

SB_URL = 'https://ckyjkxbqsyjoqpuqwoce.supabase.co'
# 공개 anon 키 (오피스 index.html 과 같은 값). 표는 못 읽고 ke_award_* 함수만 부를 수 있다.
SB_KEY = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreWpreGJxc3lqb3FwdXF3b2NlIiwicm9sZSI6ImFub24i'
          'LCJpYXQiOjE3Nzg0MjI2NzEsImV4cCI6MjA5Mzk5ODY3MX0.C8WIGqf-zIYkCq0dGWTMjIYuPM-IVInMn1p6FaWbVKA')
KE = 'https://www.koreanair.com'
PAGE = KE + '/booking/book-and-manage/award-seat-availability'
API = KE + '/api/hmp/bonusSeatView/bonusSeatView'
UA = 'BrightbeedAwardCalendar/1.0 (Python urllib)'
KST = timezone(timedelta(hours=9))
CONF = os.path.expanduser('~/.config/brightbeed')
KEY_FILE = os.path.join(CONF, 'ke-award.key')
LOCK_FILE = os.path.join(CONF, 'ke-award.lock')
GAP = (3.0, 5.0)          # 대한항공 요청 사이 (초)
FLUSH = 5                 # 몇 개마다 저장소에 올릴지
MAX_FAILS = 3             # 연달아 이만큼 실패하면 이번 회차는 멈춤


class Blocked(Exception):
    """대한항공이 접속을 막음 — 좌석 없음으로 해석하지 않는다."""


def log(msg):
    print('[%s] %s' % (datetime.now(KST).strftime('%Y-%m-%d %H:%M:%S'), msg), flush=True)


# ── 오피스 저장소 ─────────────────────────────────────────────────────────
def rpc(name, body):
    req = urllib.request.Request(
        SB_URL + '/rest/v1/rpc/' + name, data=json.dumps(body).encode('utf-8'), method='POST',
        headers={'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        raise RuntimeError('저장소 %s HTTP %s %s' % (name, e.code, e.read()[:200].decode('utf-8', 'replace'))) from None


def load_key():
    os.makedirs(CONF, mode=0o700, exist_ok=True)
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE) as f:
            k = f.read().strip()
        if len(k) >= 32:
            return k
    k = secrets.token_hex(32)
    fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(k + '\n')
    log('새 수집기 열쇠를 만들었어요 (%s)' % KEY_FILE)
    return k


# ── 대한항공 공개 현황 ────────────────────────────────────────────────────
class KoreanAir:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.session_id = uuid.uuid4().hex + datetime.now(KST).strftime('%Y%m%d') + 'W'

    def _req(self, url, body=None):
        h = {
            'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'ko-KR',
            'Content-Type': 'application/json', 'Origin': KE, 'Referer': PAGE, 'channel': 'pc',
            'ksessionId': self.session_id, 'timestamp': str(int(time.time() * 1000)),
        }
        if body is not None:
            for c in self.cookies:
                if c.name == 'XSRF-TOKEN':
                    h['X-XSRF-TOKEN'] = unquote(c.value)
        req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode('utf-8'), headers=h)
        try:
            with self.opener.open(req, timeout=30) as r:
                raw = r.read()
        except urllib.error.HTTPError as e:
            code = e.code
            e.close()
            if code in (403, 428, 429):
                raise Blocked('HTTP %d' % code) from None
            raise RuntimeError('대한항공 HTTP %d' % code) from None
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as e:
            raise RuntimeError('네트워크 (%s)' % type(e).__name__) from None
        if b'Access Denied' in raw[:2000]:
            raise Blocked('Access Denied')
        return raw

    def open(self):
        self._req(PAGE)

    def month(self, o, d, m):
        raw = self._req(API, {'arrivalAirport': d, 'departureAirport': o, 'departureDate': m})
        try:
            return json.loads(raw)
        except ValueError:
            raise RuntimeError('JSON 이 아닌 응답') from None


def parse(payload, o, d, m, today, last):
    """O · A 가능 좌석만. 형식이 다르면 ValueError (좌석 없음으로 치지 않음)."""
    if not isinstance(payload, dict):
        raise ValueError('응답이 객체가 아님')
    if payload.get('departureAirport') not in (None, o) or payload.get('arrivalAirport') not in (None, d):
        raise ValueError('응답 노선이 다름')
    fl = payload.get('flightList')
    if fl is None:
        # 운항하지 않는 노선은 오류 코드로 올 수 있다 — 내용을 남겨 둔다
        msg = payload.get('message') or payload.get('code') or payload.get('errorMessage') or list(payload.keys())[:6]
        raise ValueError('flightList 없음: %s' % str(msg)[:120])
    if not isinstance(fl, list):
        raise ValueError('flightList 형식')
    want = (int(m[:4]), int(m[4:6]))
    flights, seats = set(), []
    for day in fl:
        if not isinstance(day, dict):
            raise ValueError('날짜 형식')
        ds = str(day.get('departureDate') or '')
        if not re.fullmatch(r'\d{8}', ds):
            raise ValueError('날짜 없음')
        dt = date(int(ds[:4]), int(ds[4:6]), int(ds[6:]))
        if (dt.year, dt.month) != want:
            raise ValueError('요청한 달과 다른 날짜')
        for x in day.get('flightDetailList') or []:
            if not isinstance(x, dict) or not isinstance(x.get('availableSeat'), bool):
                raise ValueError('좌석 형식')
            fn = str(x.get('flightNumber') or '').replace(' ', '').upper()
            if not re.fullmatch(r'[A-Z0-9]{2}\d{1,4}', fn):
                continue
            flights.add((ds, fn))
            cab = str(x.get('bookingClass') or '').strip().upper()
            if cab in ('O', 'A') and x['availableSeat'] and today <= dt <= last:
                seats.append({'date': dt.isoformat(), 'fn': fn, 't': str(x.get('departureTime') or '')[:5], 'c': cab})
    return ('ok' if flights else 'empty'), len(flights), seats


# ── 한 번 돌기 ───────────────────────────────────────────────────────────
def run(limit):
    os.makedirs(CONF, mode=0o700, exist_ok=True)
    lock = open(LOCK_FILE, 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log('이미 도는 중 — 건너뜀')
        return 0

    key = load_key()
    reg = rpc('ke_award_register', {'p_key': key, 'p_name': socket.gethostname().split('.')[0][:60]})
    if not reg or not reg.get('ok'):
        log('등록 실패: %s' % reg)
        return 1
    if reg.get('status') != 'approved':
        log('승인 대기 (%s) — 오피스 관리자 전용 › 마일리지 캘린더에서 [승인] 을 눌러 주세요. id=%s' % (reg.get('status'), reg.get('id')))
        return 0

    plan = rpc('ke_award_plan', {'p_key': key, 'p_limit': limit})
    if not plan or not plan.get('ok'):
        log('계획 실패: %s' % plan)
        return 1
    if plan.get('blocked_until'):
        log('대한항공이 막은 뒤라 쉬는 중 — %s 까지' % plan['blocked_until'])
        return 0
    items = plan.get('items') or []
    if not items:
        log('모두 최신 — 읽을 것 없음')
        return 0
    today = date.fromisoformat(plan['today'])
    last = date.fromisoformat(plan['last'])

    t0 = time.time()
    st = {'requests': 0, 'ok': 0, 'failed': 0, 'blocked': False, 'new': 0, 'note': None}
    buf = []

    def flush():
        if not buf:
            return
        r = rpc('ke_award_ingest', {'p_key': key, 'p_items': buf})
        if r and r.get('ok'):
            st['new'] += int(r.get('new') or 0)
        else:
            log('올리기 실패: %s' % r)
        del buf[:]

    ke = KoreanAir()
    try:
        ke.open()
        fails = 0
        for i, it in enumerate(items):
            if i:
                time.sleep(random.uniform(*GAP))
            o, d, m = it['o'], it['d'], it['m']
            st['requests'] += 1
            try:
                status, nflights, seats = parse(ke.month(o, d, m), o, d, m, today, last)
                buf.append({'o': o, 'd': d, 'm': m, 'status': status, 'flights': nflights, 'seats': seats})
                st['ok'] += 1
                fails = 0
                if seats:
                    log('%s→%s %s.%s 프레스티지 %d · 일등석 %d' % (o, d, m[:4], m[4:6],
                        sum(1 for s in seats if s['c'] == 'O'), sum(1 for s in seats if s['c'] == 'A')))
            except Blocked:
                raise
            except (ValueError, RuntimeError) as e:
                st['failed'] += 1
                fails += 1
                buf.append({'o': o, 'd': d, 'm': m, 'status': 'error', 'flights': 0, 'err': str(e)[:300]})
                log('%s→%s %s 실패: %s' % (o, d, m, e))
                if fails >= MAX_FAILS:
                    st['note'] = '연달아 %d번 실패 — 이번 회차 멈춤 (%s)' % (fails, e)
                    break
            if len(buf) >= FLUSH:
                flush()
    except Blocked as e:
        st['blocked'] = True
        st['note'] = '대한항공이 접속을 막음 (%s) — 잠시 쉬었다가 다시' % e
        log(st['note'])
    except RuntimeError as e:
        st['failed'] += 1
        st['note'] = str(e)[:300]
        log('대한항공 접속 실패: %s' % e)
    finally:
        try:
            flush()
        finally:
            st['ms'] = int((time.time() - t0) * 1000)
            r = rpc('ke_award_report', {'p_key': key, 'p_stats': st})
            log('끝 — 요청 %(requests)d · 성공 %(ok)d · 실패 %(failed)d · 새 좌석 %(new)d' % st
                + (' · 다음 시도 %s 뒤' % r.get('blocked_until') if r and r.get('blocked_until') else ''))
    return 0


def main():
    ap = argparse.ArgumentParser(description='대한항공 마일리지 좌석 수집기 (오피스 대표 전용 캘린더)')
    ap.add_argument('--limit', type=int, default=int(os.environ.get('KE_AWARD_LIMIT', '40')))
    ap.add_argument('--status', action='store_true', help='저장소 상태만 보기')
    a = ap.parse_args()
    if a.status:
        s = rpc('ke_award_status', {})
        print(json.dumps({k: s.get(k) for k in ('state', 'coverage', 'collectors')}, ensure_ascii=False, indent=1))
        return 0
    return run(max(1, min(a.limit, 200)))


if __name__ == '__main__':
    sys.exit(main())
