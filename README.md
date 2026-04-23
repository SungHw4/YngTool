# YngTool

개인 개발자 업무 대시보드 — SVN/Git 커밋 로그, Mantis/Jira 이슈, AI 코드 리뷰, Gmail

## 사전 요구사항

- Node.js 18+
- SVN CLI (TortoiseSVN 설치 시 "command line client tools" 체크)
  ```
  svn --version   # 확인
  ```

## 설치 및 실행

```bash
npm install
npm start
```

> React dev 서버(3000포트)가 먼저 뜬 뒤 Electron 창이 열립니다.

## 빌드 (Windows .exe)

```bash
npm run build
```
`dist/` 폴더에 설치 파일이 생성됩니다.

## 초기 설정

1. 앱 실행 후 좌측 하단 ⚙ 아이콘 → 설정
2. SVN/Git 저장소 경로 입력
3. Mantis URL + API Token 입력 (사내망에서만 작동)
4. Anthropic API Key 입력 (코드 리뷰 기능)
5. 설정 저장

## 파일 구조

```
devdash/
├── src/
│   ├── main/
│   │   ├── main.js          # Electron 메인 프로세스 (IPC, SVN/Git 실행)
│   │   └── preload.js       # contextBridge (보안)
│   ├── renderer/
│   │   ├── App.jsx           # 메인 레이아웃
│   │   ├── store/
│   │   │   └── AppContext.jsx  # 전역 상태
│   │   ├── providers/
│   │   │   └── IssueProviders.js  # Mantis/Jira 추상화
│   │   ├── components/
│   │   │   ├── CommitPanel.jsx    # SVN+Git 커밋 로그 + 우클릭 메뉴
│   │   │   ├── IssuePanel.jsx     # 이슈 목록
│   │   │   ├── StatusPanel.jsx    # 연결 상태
│   │   │   └── CodeReviewModal.jsx # AI 코드 리뷰
│   │   └── pages/
│   │       └── SettingsPage.jsx   # 설정 화면
│   ├── index.js
│   └── index.css
└── public/
    └── index.html
```

---

## Gmail 연동 설정 가이드

Gmail 기능은 Google Cloud Console에서 OAuth2 앱을 직접 등록해야 사용할 수 있습니다.
**무료**로 생성 가능하며, 결제가 필요하지 않습니다.

### 1단계 — Google Cloud Console 프로젝트 생성

1. [console.cloud.google.com](https://console.cloud.google.com) 접속 (Google 계정 로그인)
2. 상단 프로젝트 선택 드롭다운 → **"새 프로젝트"** 클릭
3. 프로젝트 이름 입력 (예: `YngTool`) → **만들기**

### 2단계 — Gmail API 활성화

1. 좌측 메뉴 → **"API 및 서비스"** → **"라이브러리"**
2. 검색창에 `Gmail API` 입력 → 선택
3. **"사용 설정"** 버튼 클릭

### 3단계 — OAuth 동의 화면 구성

1. **"API 및 서비스"** → **"OAuth 동의 화면"**
2. User Type: **"외부"** 선택 → **"만들기"**
3. 앱 이름: `YngTool`, 지원 이메일: 본인 이메일 입력 → **"저장 후 계속"**
4. 범위(Scopes) 단계: **"범위 추가 또는 삭제"** 클릭
   - `https://www.googleapis.com/auth/gmail.readonly` 검색 후 체크
   - **"업데이트"** → **"저장 후 계속"**
5. 테스트 사용자 단계: **"+ ADD USERS"** → 본인 Google 계정 이메일 추가
   > ⚠ 이 단계를 건너뛰면 인증 시 "액세스 차단됨" 오류가 발생합니다.
6. 요약 단계: **"대시보드로 돌아가기"**

### 4단계 — OAuth2 클라이언트 ID 생성

1. **"API 및 서비스"** → **"사용자 인증 정보"**
2. **"+ 사용자 인증 정보 만들기"** → **"OAuth 클라이언트 ID"** 선택
3. 애플리케이션 유형: **"데스크톱 앱"** 선택
4. 이름: `YngTool Desktop` (자유 입력)
5. **"만들기"** 클릭
6. 팝업에서 **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사

> Google은 데스크톱 앱에서 `http://localhost` (포트 무관)를 자동으로 허용하므로
> 별도로 리디렉션 URI를 등록할 필요가 없습니다.

### 5단계 — YngTool 설정

1. YngTool 실행 → 좌측 **⚙ 설정** 클릭
2. **Gmail 설정** 섹션 → **Gmail 활성화** 체크
3. **Client ID** 와 **Client Secret** 붙여넣기
4. **"Google 계정 연결"** 버튼 클릭
5. 브라우저가 열리면 Gmail 연동할 Google 계정으로 로그인 → 권한 허용
6. 브라우저 창이 닫히고 "연결됨" 표시 확인
7. **"설정 저장"** 클릭

이후 좌측 사이드바 **✉ Gmail** 탭에서 받은편지함을 확인할 수 있습니다.  
새 메일이 도착하면 앱 내 알림(◉)과 Windows 토스트 알림으로 알려줍니다.

---

## 향후 추가 예정

- [ ] SVN diff IPC 구현
- [ ] Slack / 메신저 연동
- [ ] 외부 캘린더 연동
