@echo off
echo 🐍 Setting up Python environment for SecuADR ML training...

:: Ensure we're in the training directory
cd /d "%~dp0"

:: Create virtual environment
echo 📦 Creating virtual environment...
python -m venv venv

:: Activate virtual environment
echo 🔌 Activating virtual environment...
call venv\Scripts\activate.bat

:: Upgrade pip
echo ⬆️ Upgrading pip...
python -m pip install --upgrade pip

:: Install requirements
echo 📚 Installing Python dependencies...
pip install -r requirements.txt

echo.
echo ✅ Python environment setup complete!
echo.
echo To use the environment:
echo   cd training
echo   venv\Scripts\activate
echo   python train_cnn_model.py
echo.
echo To deactivate:
echo   deactivate

pause
