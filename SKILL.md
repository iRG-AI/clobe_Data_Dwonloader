---
name: clobe-finance-updater
description: >
  clobe.ai에서 재무 데이터를 자동 다운로드하여 로컬 엑셀 파일을 갱신하는
  Node.js + Python 웹앱. YouTube 요약기(youtube-notion-app)와 동일한
  server.js + plist 패턴. 포트: 3001.
  트리거: "clobe 업데이트", "재무 자동화", "통장 카드 다운로드 자동화" 등.
---

# clobe.ai 재무 자동 업데이트 앱 SKILL

## 아키텍처 패턴 (YouTube 요약기와 동일)

| 파일 | 역할 |
|---|---|
| `clobe-server.js` | Node.js HTTP 서버 (localhost:3001) — Python 실행·로그 SSE·스케줄러 모드 |
| `clobe-index.html` | 웹 UI — 연도 선택·실행·실시간 로그·이력 |
| `clobe_update.py` | Python Selenium + openpyxl 자동화 핵심 |
| `clobe-config.json` | 설정 (ID/PW/경로/텔레그램) — .gitignore 등록 필수 |
| `com.irichgreen.clobe.plist` | Mac launchd 스케줄 (매일 06:00) |
| `install.sh` | 1회 설치 스크립트 |

---

## clobe.ai UI 구조

### 통장 내역 (`/clobe/transactions`)
- 날짜: `.ant-picker-range` 클릭 → `li[text='올해']` 클릭
- 다운로드: 엑셀 다운로드 → **서브메뉴 있음** → 거래내역(분류 제외) hover → 통합 파일(xlsx)
- 파일 패턴: `*은행 거래내역*.xlsx`

### 카드 승인내역 (`/clobe/card-approval` → 승인 탭)
- 탭: `.ant-segmented-item-label` → '승인' 클릭
- 다운로드: **서브메뉴 있음** → 거래내역 hover → 통합 파일(xlsx)
- 파일 패턴: `*카드 승인내역*.xlsx`

### 카드 매입내역 (`/clobe/card-approval` → 매입 탭)
- 탭: `.ant-segmented-item-label` → '매입' 클릭
- 다운로드: **서브메뉴 없음** → 직접 통합 파일(xlsx)
- 파일 패턴: `*카드 매입내역*.xlsx`

### 세금계산서 (`/clobe/tax-invoice?type=list`)
- 날짜: '연' 탭 버튼 클릭
- 파일 패턴: `*세금계산서 데이터*.xlsx`

---

## 엑셀 업데이트 매핑

| 소스 | 대상 파일 | 시트 | 컬럼 | 날짜 컬럼 |
|---|---|---|---|---|
| 은행 거래내역 | 재무관리 | `FY26-입출금` | 0~12 (13개) | 0 (거래일시) |
| 세금계산서 | 재무관리 | `세금계산서` | 0~12 (13개) | 1 (작성일자) |
| 카드 승인내역 | 카드관리 | `사용내역` | 0~22 (23개) | 0 (승인일시) |
| 카드 매입내역 | 카드관리 | `사용내역` 또는 `매입내역` | 0~22 (23개) | 0 (승인일시) |

**헤더 처리**: clobe 다운로드 파일 `rows[1:]` 부터 (첫 행 헤더 제외)

---

## 파일 저장 규칙

```
FY[YY] 재무관리_[YYYYMMDD]_V[seq].xlsx
FY[YY] 카드관리_[YYYYMMDD]_V[seq].xlsx
기존 파일 → {finance_dir}/old/ 자동 백업
```

## 주의사항
- Chrome 기존 프로필 재사용 (`~/Library/Application Support/Google/Chrome`)
- 실행 전 엑셀 파일 닫아둘 것
- `clobe-config.json` 절대 커밋 금지 (.gitignore 등록)
- 포트 3001 (YouTube 요약기 3000과 분리)
- 스케줄러: `node clobe-server.js --scheduler` → 환경변수 `CLOBE_YEAR` 현재 연도 자동 사용
