@echo off
:: Script para rodar testes e salvar outputs em arquivos
:: Útil para comparar resultados entre versões

setlocal enabledelayedexpansion

:: Cria pasta de outputs se não existir
if not exist "test_outputs" mkdir test_outputs

:: Timestamp para nomear arquivos
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=%datetime:~0,8%_%datetime:~8,6%

echo.
echo ========================================================
echo     RODANDO TESTES E SALVANDO OUTPUTS
echo ========================================================
echo Timestamp: %timestamp%
echo.

:: Teste Rápido
echo [1/3] Executando Teste Rapido...
python test_quick.py > "test_outputs\quick_%timestamp%.txt" 2>&1
if %errorlevel%==0 (
    echo [OK] Salvo em: test_outputs\quick_%timestamp%.txt
) else (
    echo [ERRO] Teste falhou - veja test_outputs\quick_%timestamp%.txt
)
echo.

:: Aguarda para não sobrecarregar API
timeout /t 3 /nobreak >nul

:: Teste de Análise  
echo [2/3] Executando Teste de Analise...
python test_analysis.py > "test_outputs\analysis_%timestamp%.txt" 2>&1
if %errorlevel%==0 (
    echo [OK] Salvo em: test_outputs\analysis_%timestamp%.txt
) else (
    echo [ERRO] Teste falhou - veja test_outputs\analysis_%timestamp%.txt
)
echo.

:: Aguarda para não sobrecarregar API
timeout /t 5 /nobreak >nul

:: Fluxo Completo
echo [3/3] Executando Fluxo Completo...
python test_full_flow.py > "test_outputs\full_%timestamp%.txt" 2>&1
if %errorlevel%==0 (
    echo [OK] Salvo em: test_outputs\full_%timestamp%.txt
) else (
    echo [ERRO] Teste falhou - veja test_outputs\full_%timestamp%.txt
)
echo.

echo ========================================================
echo TESTES CONCLUIDOS!
echo ========================================================
echo.
echo Outputs salvos em: test_outputs\
echo.
echo Arquivos gerados:
dir /b "test_outputs\*%timestamp%*"
echo.
echo Para comparar com testes anteriores:
echo   fc test_outputs\full_[data1].txt test_outputs\full_[data2].txt
echo.

pause
