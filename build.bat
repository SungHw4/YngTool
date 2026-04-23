@echo off
cd /d %~dp0
echo [YngTool] 빌드를 시작합니다...
npm run build
echo.
echo [YngTool] 빌드 완료. dist\ 폴더를 확인하세요.
pause
