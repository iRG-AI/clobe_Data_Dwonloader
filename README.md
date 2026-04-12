# 💰 clobe_Data_Downloader

> **clobe.ai** 재무 SaaS에서 통장·카드·세금계산서 데이터를 자동 다운로드하고,  
> 로컬 엑셀 파일(재무관리·카드관리)을 자동으로 갱신하는 **로컬 웹 자동화 앱**입니다.

---

## ⚡ Vibe Coding with AI

본 프로젝트는 AI 에이전트 기술을 활용하여 구현 및 고도화되었습니다.

- **Agentic Tool**: [Claude](https://claude.ai) (Anthropic)
- **Coding Style**: **Vibe Coding** (AI-driven iterative design & implementation)
- **Browser Automation**: Selenium WebDriver (Chrome)
- **Data Processing**: Python + openpyxl

---

## 📌 프로젝트 개요

매일 반복되던 수작업 재무 데이터 정리 업무를 완전 자동화합니다.

| 기존 방식 | 자동화 후 |
|---|---|
| clobe.ai 접속 → 수동 다운로드 | 버튼 하나로 자동 다운로드 |
| 엑셀 파일 직접 복사·붙여넣기 | 자동 갱신 (수식 컬럼 보존) |
| 파일명 수동 관리 | 버전명 자동 생성 + old 폴더 백업 |
| 매일 반복 | Mac 스케줄러로 매일 자동 실행 |

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────┐
│            clobe-index.html                 │
│         웹 UI (localhost:3001)              │
│   연도 선택 · 실행 · 실시간 로그 · 이력     │
└─────────────┬───────────────────────────────┘
              │ HTTP
┌─────────────▼───────────────────────────────┐
│           clobe-server.js                   │
│       Node.js 백엔드 서버                   │
│   ├─ /run   : Python 스크립트 실행          │
│   ├─ /stop  : 프로세스 중지                 │
│   ├─ /logs/stream : SSE 실시간 로그         │
│   └─ --scheduler : launchd 자동 실행 모드   │
└─────────────┬───────────────────────────────┘
              │ child_process
┌─────────────▼───────────────────────────────┐
│           clobe_update.py                   │
│     Python Selenium 자동화 엔진             │
│   ├─ [1/4] 통장내역 다운로드               │
│   ├─ [2/4] 카드 승인내역 다운로드          │
│   ├─ [3/4] 카드 매입내역 다운로드          │
│   └─ [4/4] 세금계산서 다운로드             │
└─────────────┬───────────────────────────────┘
              │ openpyxl
┌─────────────▼───────────────────────────────┐
│         로컬 엑셀 파일 갱신                 │
│   ├─ FY26 재무관리_YYYYMMDD_VN.xlsx        │
│   └─ FY26 카드관리_YYYYMMDD_VN.xlsx        │
└─────────────────────────────────────────────┘
```

---

## 📂 파일 구성

```
clobe_Data_Downloader/
├── clobe-server.js              # Node.js HTTP 서버 (포트 3001)
├── clobe-index.html             # 웹 UI
├── clobe_update.py              # Python 자동화 핵심 로직
├── clobe-config.json            # 설정 파일 (ID/PW/경로/텔레그램)
├── com.irichgreen.clobe.plist   # Mac launchd 스케줄 설정
├── install.sh                   # 최초 1회 설치 스크립트
├── SKILL.md                     # Claude AI 참조 문서
├── .gitignore                   # 민감정보 제외 설정
├── README.md                    # 이 파일
└── logs/                        # 실행 로그 자동 생성
```

---

## 🎯 주요 기능

### 1. 웹 UI (clobe-index.html)
- **연도 선택** — 올해/작년/재작년 버튼 또는 직접 입력 (특정 연도 데이터만 처리)
- **실시간 로그 스트리밍** — Server-Sent Events(SSE)로 진행 상황 실시간 표시
- **실행 이력 관리** — 과거 실행 로그 목록 및 조회
- **설정 요약 표시** — config.json 기반 현재 설정 확인

### 2. 자동 다운로드 (clobe.ai Selenium 자동화)

| 단계 | 대상 | URL | 파일명 패턴 |
|---|---|---|---|
| 1/4 | 통장 내역 | `/clobe/transactions` | `*은행 거래내역*.xlsx` |
| 2/4 | 카드 승인내역 | `/clobe/card-approval` → 승인 탭 | `*카드 승인내역*.xlsx` |
| 3/4 | 카드 매입내역 | `/clobe/card-approval` → 매입 탭 | `*카드 매입내역*.xlsx` |
| 4/4 | 세금계산서 | `/clobe/tax-invoice` | `*세금계산서 데이터*.xlsx` |

### 3. 엑셀 자동 갱신 (openpyxl)

| 소스 파일 | 대상 파일 | 시트 | 데이터 컬럼 |
|---|---|---|---|
| 은행 거래내역 | 재무관리 | `FY26-입출금` | 0~12 (13개) |
| 세금계산서 데이터 | 재무관리 | `세금계산서` | 0~12 (13개) |
| 카드 승인내역 | 카드관리 | `사용내역` | 0~22 (23개) |
| 카드 매입내역 | 카드관리 | `사용내역` | 0~22 (23개) |

- 기존 해당 연도 데이터 삭제 후 신규 데이터 삽입
- 수식 컬럼 (`[[#This Row]]` 구조) 자동 복사 보존
- **헤더 제외** — clobe 다운로드 파일의 첫 번째 행(헤더)은 제외하고 순수 데이터만 삽입

### 4. 파일 버전 관리

```
저장 형식:
  FY[YY] 재무관리_[YYYYMMDD]_V[N].xlsx
  FY[YY] 카드관리_[YYYYMMDD]_V[N].xlsx

예시:
  FY26 재무관리_20260412_V1.xlsx   ← 오늘 첫 번째 실행
  FY26 재무관리_20260412_V2.xlsx   ← 오늘 두 번째 실행
  old/FY26 재무관리_V1.2_20260411.xlsx  ← 기존 파일 자동 백업
```

### 5. Mac 자동 스케줄러

- Mac `launchd` 기반 — 매일 지정 시간 자동 실행 (기본: 오전 6시)
- `node clobe-server.js --scheduler` 모드로 Python 직접 실행
- 텔레그램 알림 지원 (완료/실패 알림)

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|---|---|
| 웹 서버 | Node.js (내장 `http` 모듈) |
| 웹 UI | Vanilla HTML/CSS/JS (프레임워크 없음) |
| 실시간 통신 | Server-Sent Events (SSE) |
| 브라우저 자동화 | Python + Selenium WebDriver |
| 데이터 처리 | Python + openpyxl |
| 스케줄링 | Mac launchd (plist) |
| 알림 | Telegram Bot API |

---

## 📦 설치 및 실행

### 사전 요구사항
- macOS
- Node.js (`brew install node`)
- Python 3 (`brew install python`)
- Google Chrome

### STEP 1. 설정 파일 수정

`clobe-config.json`을 열어 실제 정보 입력:

```json
{
  "clobe": {
    "url":      "https://app.clobe.ai/",
    "id":       "your@email.com",
    "password": "실제비밀번호"
  },
  "paths": {
    "finance_dir": "/Users/your/재무관리폴더",
    "download_dir": "/Users/your/Downloads"
  },
  "telegram": {
    "enabled":  false,
    "botToken": "",
    "chatId":   ""
  }
}
```

### STEP 2. 최초 1회 설치

```bash
bash install.sh
```

- Python 패키지 자동 설치 (`selenium`, `webdriver-manager`, `openpyxl`)
- Mac launchd 스케줄 등록
- 실행 시간 선택

### STEP 3. 웹 UI 실행

```bash
node clobe-server.js
```

브라우저에서 `http://localhost:3001` 접속

1. 연도 선택 (올해 / 작년 / 직접 입력)
2. **▶ 지금 실행** 클릭
3. 실시간 로그로 진행 상황 확인

---

## ⚙️ 스케줄러 관련 명령어

```bash
# 스케줄러 즉시 테스트
launchctl start com.irichgreen.clobe

# 등록 확인
launchctl list | grep irichgreen

# 실시간 로그 확인
tail -f logs/scheduler.log

# 스케줄 제거
launchctl unload ~/Library/LaunchAgents/com.irichgreen.clobe.plist
```

---

## 🔒 보안 주의사항

- `clobe-config.json`에 로그인 정보가 포함됩니다. **절대 공개 저장소에 커밋하지 마세요.**
- `.gitignore`에 `clobe-config.json`이 등록되어 있습니다.
- Chrome 기존 프로필을 재사용하므로 이미 로그인된 상태라면 별도 로그인 불필요합니다.

---

## 📋 업데이트 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.0 | 2026-04-12 | 최초 릴리즈 — 통장·카드승인·세금계산서 자동화 |
| v1.1 | 2026-04-12 | 카드 매입내역 추가, 연도 선택 UI, 파일 버전 관리, Mac 스케줄러 통합 |

---

© 2026 iRichGreen. Powered by **Claude (Anthropic)** Vibe Coding.
