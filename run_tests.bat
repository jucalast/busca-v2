@echo off
:: Script de automação para rodar testes do sistema
:: Use: run_tests.bat [quick|analysis|full|all]

setlocal enabledelayedexpansion

echo.
echo ========================================================
echo              TESTES DO SISTEMA - MENU
echo ========================================================
echo.

:: Verifica se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado!
    echo Por favor, instale Python 3.7+ e tente novamente.
    pause
    exit /b 1
)

:: Verifica se requests está instalado
python -c "import requests" >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Biblioteca 'requests' nao encontrada.
    echo.
    set /p install="Deseja instalar agora? (S/N): "
    if /i "!install!"=="S" (
        echo Instalando requests...
        pip install requests
        if %errorlevel% neq 0 (
            echo [ERRO] Falha ao instalar requests
            pause
            exit /b 1
        )
    ) else (
        echo [ERRO] Biblioteca 'requests' e necessaria para os testes.
        pause
        exit /b 1
    )
)

:: Verifica se o servidor está rodando
echo Verificando se o servidor esta rodando...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    curl -s http://localhost:3001 >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [AVISO] Servidor nao esta respondendo em localhost:3000 ou :3001
        echo.
        set /p continue="Deseja continuar mesmo assim? (S/N): "
        if /i "!continue!" neq "S" (
            echo.
            echo Inicie o servidor com: npm run dev
            pause
            exit /b 1
        )
    )
)

echo [OK] Servidor respondendo
echo.

:: Menu de opções
if "%1"=="" (
    echo Escolha um teste:
    echo.
    echo  1 - Teste Rapido        [~15s]    Validacao basica
    echo  2 - Teste de Analise    [~2min]   Debug de analise completa
    echo  3 - Fluxo Completo      [~5min]   Teste end-to-end
    echo  4 - Todos os testes     [~7min]   Executa 1, 2 e 3
    echo  5 - Sair
    echo.
    set /p choice="Digite sua escolha (1-5): "
    
    if "!choice!"=="1" set test=quick
    if "!choice!"=="2" set test=analysis
    if "!choice!"=="3" set test=full
    if "!choice!"=="4" set test=all
    if "!choice!"=="5" exit /b 0
    
    if "!test!"=="" (
        echo [ERRO] Opcao invalida
        pause
        exit /b 1
    )
) else (
    set test=%1
)

echo.
echo ========================================================

:: Executa os testes
if "%test%"=="quick" (
    echo Executando Teste Rapido...
    echo ========================================================
    echo.
    python test_quick.py
    set result=!errorlevel!
    goto :end
)

if "%test%"=="analysis" (
    echo Executando Teste de Analise...
    echo ========================================================
    echo.
    python test_analysis.py
    set result=!errorlevel!
    goto :end
)

if "%test%"=="full" (
    echo Executando Fluxo Completo...
    echo ========================================================
    echo.
    python test_full_flow.py
    set result=!errorlevel!
    goto :end
)

if "%test%"=="all" (
    echo Executando TODOS os testes...
    echo.
    
    echo [1/3] Teste Rapido
    echo ========================================================
    python test_quick.py
    if !errorlevel! neq 0 (
        echo [ERRO] Teste Rapido falhou
        set result=1
        goto :end
    )
    echo.
    echo [OK] Teste Rapido passou
    echo.
    timeout /t 3 /nobreak >nul
    
    echo [2/3] Teste de Analise
    echo ========================================================
    python test_analysis.py
    if !errorlevel! neq 0 (
        echo [ERRO] Teste de Analise falhou
        set result=1
        goto :end
    )
    echo.
    echo [OK] Teste de Analise passou
    echo.
    timeout /t 5 /nobreak >nul
    
    echo [3/3] Fluxo Completo
    echo ========================================================
    python test_full_flow.py
    if !errorlevel! neq 0 (
        echo [ERRO] Fluxo Completo falhou
        set result=1
        goto :end
    )
    echo.
    echo [OK] Fluxo Completo passou
    echo.
    
    echo ========================================================
    echo TODOS OS TESTES PASSARAM!
    echo ========================================================
    set result=0
    goto :end
)

echo [ERRO] Teste desconhecido: %test%
echo Use: quick, analysis, full ou all
set result=1

:end
echo.
if %result%==0 (
    echo [SUCESSO] Teste concluido com sucesso!
) else (
    echo [FALHA] Teste falhou - verifique os logs acima
)
echo.
pause
exit /b %result%
