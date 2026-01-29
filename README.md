# 급식 알리미 (Vanilla HTML/CSS/JS)

학교 급식을 **예쁘고 빠르게** 확인하는 급식 조회 웹사이트입니다.  
프레임워크 없이 **HTML/CSS/JavaScript만** 사용합니다.

## 실행 방법

브라우저에서 `index.html`을 **그냥 더블클릭**하면 모듈 로딩이 막힐 수 있어요(보안 정책).  
아래처럼 **로컬 서버로 실행**하세요.

### 방법 A) VS Code / Cursor Live Server

- `index.html` 우클릭 → **Open with Live Server**

### 방법 B) PowerShell (Python 설치되어 있을 때)

```bash
python -m http.server 5500
```

그 다음 브라우저에서 `http://localhost:5500` 접속

## API 키 설정(필수)

1. 나이스 교육정보 개방 포털에서 Open API 키 발급
2. `js/config.example.js`를 참고해서 `js/config.js`의 `NEIS_API_KEY`에 키 입력

> `js/config.js`는 `.gitignore`에 포함되어 있어, GitHub에 키가 올라가는 것을 방지합니다.

## 구현된 기능(PRD 대응)

- 학교 검색(실시간 검색 + 결과 리스트)
- 선택한 학교 LocalStorage 저장(재접속 자동 로드)
- 급식 조회(오늘 자동 표시 + 주간 월~금 요약)
- 급식 미제공일 안내
- 알레르기 정보 숫자 분리 표시(원문 표기 기반)
- 즐겨찾기 최대 3개(클릭 한 번 전환, 관리 모드에서 삭제)
- 스켈레톤 로딩 UI
- 오류 메시지 + 재시도 버튼
- 모바일 우선 반응형(태블릿/데스크톱 대응)

