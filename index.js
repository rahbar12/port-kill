const { exec } = require('child_process');
const { type } = require("os");

class PortError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PortNotBusy';
    }
}


const portKill = async (...ports) => {
    const platform = type();
    const killed = []
    for (const port of ports) {
        try {
            if (platform === 'Windows_NT') {
                const pid = await getPID_netstat_win(port);
                await taskKill(pid);
            }
            else {
                const fuser = await checkCommand('fuser -V');
                if (fuser) await fuserKill(port);
                else {
                    let pid;
                    const lsof = await checkCommand('lsof -v');
                    if (lsof) pid = await getPID_lsof(port);
                    else pid = await getPID_netstat_linux(port);
                    await killProcess(pid);
                }
            }
            killed.push(port);
        } catch (error) {
        }
    }
    return killed;
}

const checkCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) resolve(false);
            else resolve(true);
        });
    });
}

const taskKill = (port) => {
    return new Promise((resolve, reject) => {
        exec(`TASKKILL /F /PID ${port} /T`, (error, stdout, stderr) => {
            if (error) {
                if (error.message.includes('not found')) reject(new PortError(`Port:${port} is not busy`));
                else reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

const fuserKill = (port) => {
    return new Promise((resolve, reject) => {
        exec(`fuser -k ${port}/tcp`, (error, stdout, stderr) => {
            if (error) {
                if (error.message.includes('No such file or directory')) reject(new PortError(`Port:${port} is not busy`));
                else reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

const getPID_lsof = (port) => {
    return new Promise((resolve, reject) => {
        exec(`lsof -t -i:${port}`, (error, stdout, stderr) => {
            if (error) {
                if (error.message.includes('No such file or directory')) reject(new PortError(`Port:${port} is not busy`));
                else reject(error);
            } else {
                return resolve(stdout.trim());
            }
        });
    });
}

const getPID_netstat_win = (port) => {
    return new Promise((resolve, reject) => {
        exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (error, stdout, stderr) => {
            if (error || !stdout) {
                if (error.message.includes('No such file or directory')) reject(new PortError(`Port:${port} is not busy`));
                else reject(error);
            } else {
                return resolve(stdout.trim().split(" ").pop());
            }
        });
    });
}


const getPID_netstat_linux = (port) => {
    return new Promise((resolve, reject) => {
        exec(`netstat -plten | grep :${port} | grep LISTEN`, (error, stdout, stderr) => {
            if (error || !stdout) {
                if (error.message.includes('No such file or directory')) reject(new PortError(`Port:${port} is not busy`));
                else reject(error);
            } else {
                return resolve(stdout.trim().split(" ").pop().split("/")[0]);
            }
        });
    });
}

const killProcess = (pid) => {
    return new Promise((resolve, reject) => {
        const command = exec(`kill -9 ${pid}`, (error, stdout, stderr) => {
            if (error) {
                if (error.message.includes('No such process')) reject(new PortError(`Process:${pid} is not busy`));
                else reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

module.exports = portKill;
