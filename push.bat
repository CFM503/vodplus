@echo off
echo ========================================
echo  推送 VodPlus 更新到远程仓库
echo ========================================
echo.
echo 当前更改:
echo   - 更新版本号: 0.6.0 -> 0.6.1
echo   - 修复 config.ts 编码问题
dir /B
cd /d %~dp0
git add -A
if errorlevel 1 (
    echo 错误: 无法添加文件到暂存区
    pause
    exit /b 1
)
echo.
git commit -m "fix: 解决 Cloudflare Pages 部署编码问题

- 修复 src/config/config.ts 中的 null 字节问题
- 转换 src/app/page.tsx 为 UTF-8 编码
- 更新版本号到 0.6.1"
if errorlevel 1 (
    echo 错误: 无法创建提交
    pause
    exit /b 1
)
echo.
echo 推送到远程仓库...
git push origin main
if errorlevel 1 (
    echo 错误: 推送失败
    pause
    exit /b 1
)
echo.
echo ========================================
echo  推送完成！
echo ========================================
pause
