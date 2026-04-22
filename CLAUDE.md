# YngTool Project Rules

## 프로젝트 개요
개인 개발자 업무 대시보드 (Electron + React + Node.js)
Git/SVN 커밋 로그, 이슈 트래커(Mantis/Jira), AI 토큰 사용량을 한 화면에서 확인

---

## 기술 스택
- **Frontend**: React 18, JavaScript (JSX)
- **Backend**: Electron 28 (Main Process: Node.js)
- **스타일**: Inline style (별도 CSS 파일 없음)
- **IPC**: contextBridge + ipcRenderer/ipcMain
- **빌드**: electron-builder (NSIS, Windows)

## 프로젝트 구조
```
src/
  main/
    main.js       - Electron 메인 프로세스, IPC 핸들러
    preload.js    - contextBridge로 renderer에 API 노출
  renderer/
    components/   - 공용 컴포넌트
    pages/        - 페이지 컴포넌트
    providers/    - IssueProviders (Mantis, Jira)
    store/        - AppContext (전역 상태)
```

## 설정 파일 경로
- 설정 저장 위치: `%APPDATA%\com.yngtool.app\config.json` (appId 기반 고정 경로)

---

## 행동 원칙
- 지시 없는 행동을 수행하지 않음
- 확실히 이해하지 못한 내용은 추측하지 말고 확인할 것
- 중요한 파일 생성 시 사용자에게 미리 알리기
- 기존 파일 수정 시 변경사항 요약 제시
- 삭제 작업은 반드시 확인받기
- 민감한 정보(API 키, 비밀번호, 내부 URL 등)는 절대 하드코딩하지 않음

## 코딩 원칙
- 성능보다 **안정성과 유지보수성**을 우선한다
- 기존 코드의 동작을 변경하지 않는다 (하위 호환성 유지)
- 작은 단위로 변경하고, 변경 범위를 최소화한다
- 명확하고 읽기 쉬운 코드를 작성한다
- 무한 루프 가능성 코드 금지
- 외부 API 호출 시 타임아웃 설정 필수

## GIT
- commit 메시지는 한국어로 작성
- commit까진 가능, **push는 절대 금지** (직접 push 할 것)
- 수정 완료 후 항상 커밋 메시지 제안할 것

---

## IPC 패턴
renderer에서 외부 API를 직접 fetch하면 CORS 문제가 발생한다.
**외부 API 호출은 반드시 main 프로세스(ipcMain)를 통해야 한다.**

추가 순서:
1. `main.js` - `ipcMain.handle('channel:name', ...)` 핸들러 추가
2. `preload.js` - `contextBridge`에 메서드 노출
3. renderer - `window.electronAPI.method()` 호출

## Windows 주의사항
- `exec()`는 cmd.exe를 통해 실행되어 `|` 문자가 파이프로 해석됨
- 외부 명령어 실행 시 `execFile()`을 사용할 것
- 구분자는 `|` 대신 `\x1f` (ASCII Unit Separator) 사용

---

## 현재 알려진 이슈 / 결정 사항
- **Mantis 연동**: 서버 REST API 비활성화로 보류. 관리자에게 활성화 요청 후 재시도
- **OpenAI Usage API**: Admin 키(`sk-admin-...`) 필요. 일반 `sk-proj-` 키 불가
- **Anthropic Usage API**: main 프로세스 IPC 경유 (CORS 우회)
