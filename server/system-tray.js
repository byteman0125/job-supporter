const path = require('path');
const os = require('os');

class SystemTray {
    constructor(serverInstance) {
        this.server = serverInstance;
        this.tray = null;
        this.isVisible = false;
        this.platform = process.platform;
        this.currentStatus = 'offline';
        
        // Simple tray - just status tracking, no actual system tray
        this.createSimpleTray();
    }

    createSimpleTray() {
        // Simple status-only tray (no GUI dependencies)
        this.tray = {
            platform: this.platform,
            status: 'offline',
            tooltip: 'Remote Provider Server',
            
            setToolTip: (tooltip) => {
                this.tooltip = tooltip;
                // Show status in console only
                console.log(`📟 ${tooltip}`);
            },
            
            destroy: () => {
                console.log('📟 Tray destroyed');
            }
        };

        console.log('📟 Status tray initialized (console mode)');
        this.isVisible = true;
        this.updateTrayStatus('connecting');
    }

    getStatusText() {
        const statusMap = {
            'connecting': 'Connecting...',
            'connected': 'Connected',
            'capturing': 'Screen Sharing',
            'error': 'Error',
            'offline': 'Offline'
        };
        
        return statusMap[this.currentStatus] || 'Unknown';
    }

    updateTrayStatus(status, message) {
        if (!this.tray) return;

        this.currentStatus = status;

        const statusMessages = {
            'connecting': '🔄 Connecting to relay...',
            'connected': '✅ Connected - Ready for viewers',
            'capturing': '🎥 Screen sharing active',
            'error': '❌ Connection error',
            'offline': '⚪ Offline'
        };

        const tooltip = statusMessages[status] || message || 'Remote Provider Server';
        
        this.tray.setToolTip(tooltip);

    // Silent - no console output
    }

    showServerInfo() {
        if (!this.server) return;

        const serverId = this.server.serverId || 'Not available';
        const isCapturing = this.server.isCapturing ? 'Active' : 'Inactive';
        const platform = os.platform();
        
        console.log('\n📟 Remote Provider Server Info:');
        console.log(`   Server ID: ${serverId}`);
        console.log(`   Screen Capture: ${isCapturing}`);
        console.log(`   Platform: ${platform}`);
        console.log(`   Status: ${this.getStatusText()}`);
        console.log('');
    }

    onViewerConnected() {
        this.updateTrayStatus('capturing');
    }

    onViewerDisconnected() {
        this.updateTrayStatus('connected');
    }

    onConnectionError(error) {
        this.updateTrayStatus('error');
    }

    onServerRegistered(serverId) {
        this.updateTrayStatus('connected');
    }

    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
            this.isVisible = false;
            console.log('📟 System tray destroyed');
        }
    }

    // Create a simple status file for monitoring
    updateStatusFile() {
        try {
            const statusFile = path.join(os.tmpdir(), 'remote-provider-status.json');
            const status = {
                timestamp: new Date().toISOString(),
                serverId: this.server?.serverId || null,
                isCapturing: this.server?.isCapturing || false,
                isConnected: this.server?.socket?.connected || false,
                platform: this.platform,
                pid: process.pid
            };

            require('fs').writeFileSync(statusFile, JSON.stringify(status, null, 2));
        } catch (error) {
            // Ignore file write errors
        }
    }

    // Method to show context menu (basic implementation)
    showContextMenu() {
        if (this.tray && this.tray.platform === 'console') {
            console.log('\n📟 Remote Provider Server Menu:');
            console.log('1. Show Server Info');
            console.log('2. Show Status');
            console.log('3. Restart Connection');
            console.log('4. Exit Server');
            console.log('Press Ctrl+C to exit\n');
        }
    }
}

module.exports = SystemTray;
