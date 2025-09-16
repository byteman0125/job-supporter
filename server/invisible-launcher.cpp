// Invisible Node.js Launcher - No Console Window
// Compile with: g++ -o remote-server.exe invisible-launcher.cpp -mwindows
// Or with Visual Studio: cl invisible-launcher.cpp /link /SUBSYSTEM:WINDOWS

#include <windows.h>
#include <string>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // Get the current directory
    char currentDir[MAX_PATH];
    GetCurrentDirectoryA(MAX_PATH, currentDir);
    
    // Build the command to run Node.js invisibly
    std::string command = "node \"";
    command += currentDir;
    command += "\\main-cli.js\" --background --silent";
    
    // Create process info structures
    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE; // Hide the window
    
    ZeroMemory(&pi, sizeof(pi));
    
    // Start the Node.js process invisibly
    CreateProcessA(
        NULL,                           // No module name (use command line)
        (LPSTR)command.c_str(),        // Command line
        NULL,                          // Process handle not inheritable
        NULL,                          // Thread handle not inheritable
        FALSE,                         // Set handle inheritance to FALSE
        CREATE_NO_WINDOW,              // No window creation flags
        NULL,                          // Use parent's environment block
        currentDir,                    // Use current directory
        &si,                           // Pointer to STARTUPINFO structure
        &pi                            // Pointer to PROCESS_INFORMATION structure
    );
    
    // Close process and thread handles
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    
    return 0;
}
