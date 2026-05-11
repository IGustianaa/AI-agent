const os = require('os');
const { execSync } = require('child_process');

/**
 * SystemMonitor - Monitor hardware dan performa sistem
 * 
 * Mengawasi:
 * - CPU usage & temperature
 * - Memory usage
 * - Load average
 * - GPU info (jika tersedia)
 */
class SystemMonitor {
  constructor() {
    this.cpuModel = os.cpus()[0]?.model || 'Unknown';
    this.cpuCores = os.cpus().length;
    this.platform = os.platform();
  }

  /**
   * Get quick stats (CPU %, temperature)
   */
  async getQuickStats() {
    const cpuPercent = await this.getCPUPercent();
    const cpuTemp = await this.getCPUTemp();

    return {
      cpuPercent,
      cpuTemp,
      freeMemGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
    };
  }

  /**
   * Get full system stats
   */
  async getFullStats() {
    const cpuPercent = await this.getCPUPercent();
    const cpuTemp = await this.getCPUTemp();
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    const loadAvg = os.loadavg();

    return {
      cpu: {
        model: this.cpuModel,
        cores: this.cpuCores,
        usage: cpuPercent,
        temp: cpuTemp,
        loadAvg: loadAvg[0].toFixed(2),
        speed: os.cpus()[0]?.speed || 0,
      },
      memory: {
        totalGB: (memTotal / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (memUsed / 1024 / 1024 / 1024).toFixed(2),
        freeGB: (memFree / 1024 / 1024 / 1024).toFixed(2),
        usedPercent: (memUsed / memTotal) * 100,
      },
      os: {
        platform: this.platform,
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
    };
  }

  /**
   * Get CPU usage percentage
   */
  async getCPUPercent() {
    return new Promise((resolve) => {
      const cpus1 = os.cpus();
      
      setTimeout(() => {
        const cpus2 = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        for (let i = 0; i < cpus1.length; i++) {
          const idle1 = cpus1[i].times.idle;
          const idle2 = cpus2[i].times.idle;
          
          const total1 = Object.values(cpus1[i].times).reduce((a, b) => a + b, 0);
          const total2 = Object.values(cpus2[i].times).reduce((a, b) => a + b, 0);

          totalIdle += (idle2 - idle1);
          totalTick += (total2 - total1);
        }

        const percent = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100) : 0;
        resolve(Math.round(percent * 10) / 10);
      }, 500);
    });
  }

  /**
   * Get CPU temperature
   */
  async getCPUTemp() {
    try {
      if (this.platform === 'linux') {
        // Try thermal zone
        try {
          const temp = execSync('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 2000,
          }).trim();
          return Math.round(parseInt(temp) / 1000);
        } catch (e) {
          // Try sensors command
          try {
            const output = execSync('sensors 2>/dev/null | grep -i "core 0" | head -1', {
              encoding: 'utf-8',
              timeout: 2000,
            });
            const match = output.match(/\+(\d+\.?\d*)/);
            if (match) return Math.round(parseFloat(match[1]));
          } catch (e2) {}
        }
      } else if (this.platform === 'darwin') {
        try {
          const output = execSync(
            'sudo powermetrics --samplers smc -i1 -n1 2>/dev/null | grep "CPU die temperature"',
            { encoding: 'utf-8', timeout: 5000 }
          );
          const match = output.match(/(\d+\.?\d*)/);
          if (match) return Math.round(parseFloat(match[1]));
        } catch (e) {}
      }
    } catch (e) {}

    // Default: estimated based on CPU usage
    return 50; // placeholder
  }

  /**
   * Check if system is suitable for mining
   */
  async checkMiningReadiness() {
    const stats = await this.getFullStats();
    const issues = [];
    const recommendations = [];

    // CPU check
    if (stats.cpu.cores < 2) {
      issues.push('CPU hanya 1 core - mining akan sangat lambat');
    }

    // Memory check
    if (parseFloat(stats.memory.freeGB) < 2) {
      issues.push(`RAM tersisa hanya ${stats.memory.freeGB} GB - minimal 2 GB disarankan`);
    }

    // Temp check
    if (stats.cpu.temp > 70) {
      issues.push(`CPU sudah panas (${stats.cpu.temp}°C) sebelum mining dimulai`);
    }

    // Load check
    if (stats.cpu.usage > 50) {
      recommendations.push(`CPU usage sudah ${stats.cpu.usage.toFixed(1)}% - kurangi beban sebelum mining`);
    }

    return {
      ready: issues.length === 0,
      issues,
      recommendations,
      stats,
    };
  }
}

module.exports = SystemMonitor;
