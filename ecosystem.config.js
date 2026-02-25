module.exports = {
    apps: [
        {
            name: 'smarteco-backend',
            script: 'dist/main.js',
            cwd: '/var/www/smarteco-backend',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },

            // Logging
            error_file: '/var/log/smarteco/error.log',
            out_file: '/var/log/smarteco/out.log',
            log_file: '/var/log/smarteco/combined.log',
            time: true,
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // Graceful shutdown
            kill_timeout: 5000,
            listen_timeout: 10000,

            // Restart policy
            max_restarts: 10,
            restart_delay: 4000,
            exp_backoff_restart_delay: 1000,
        },
    ],
};
