module.exports = {
  apps : [{
    script: 'index.js',
    watch: '.',
	name:"index"
  }, {
    script: './service-worker/',
    watch: ['./service-worker']
  }],

  deploy : {
    production : {
      user : 'ubuntu',
      host : 'ec2-3-6-89-242.ap-south-1.compute.amazonaws.com',
      ref  : 'origin/main',
      repo : 'https://github.com/KrishnaPayyavula/TaskManagerBackend.git',
      path : '~/krishna',
      'pre-deploy-local': '',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
