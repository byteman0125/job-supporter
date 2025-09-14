@echo off
echo Setting up minimal FFmpeg for screen capture...
echo.

REM Create directories
if not exist "tester\assets\ffmpeg-minimal\bin" mkdir "tester\assets\ffmpeg-minimal\bin"

REM Copy essential FFmpeg files
echo Copying essential FFmpeg files...
copy "tester\assets\ffmpeg\bin\ffmpeg.exe" "tester\assets\ffmpeg-minimal\bin\"
copy "tester\assets\ffmpeg\bin\avcodec-62.dll" "tester\assets\ffmpeg-minimal\bin\"
copy "tester\assets\ffmpeg\bin\avdevice-62.dll" "tester\assets\ffmpeg-minimal\bin\"
copy "tester\assets\ffmpeg\bin\avfilter-11.dll" "tester\assets\ffmpeg-minimal\bin\"
copy "tester\assets\ffmpeg\bin\avformat-62.dll" "tester\assets\ffmpeg-minimal\bin\"
copy "tester\assets\ffmpeg\bin\avutil-60.dll" "tester\assets\ffmpeg-minimal\bin\"
copy "tester\assets\ffmpeg\bin\swresample-6.dll" "tester\assets\ffmpeg-minimal\bin\"
copy "tester\assets\ffmpeg\bin\swscale-9.dll" "tester\assets\ffmpeg-minimal\bin\"

echo.
echo Minimal FFmpeg setup complete!
echo.
echo Essential files copied:
echo - ffmpeg.exe (main executable)
echo - avcodec-62.dll (codec library)
echo - avdevice-62.dll (device library for screen capture)
echo - avfilter-11.dll (filter library)
echo - avformat-62.dll (format library)
echo - avutil-60.dll (utility library)
echo - swresample-6.dll (resampling library)
echo - swscale-9.dll (scaling library)
echo.
echo Total size: ~200MB (vs 300MB+ for full installation)
echo.
pause
