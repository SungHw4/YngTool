# YngTool

개인 개발자 업무 대시보드 — SVN/Git 커밋 로그, Mantis/Jira 이슈, AI 코드 리뷰

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

## 향후 추가 예정

- [ ] AI 토큰 사용량 패널 (Anthropic Usage API)
- [ ] 주간 요약 자동 생성
- [ ] 일정표
- [ ] SVN diff IPC 구현
