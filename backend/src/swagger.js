const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Rift API',
    description: 'Seismic sensors network',
  },
  host: 'localhost:3000',
  schemes: ['http'],
  tags: [
    {
      name: 'Felt',                    // Group name in Swagger UI
      description: 'Endpoints related to felt/seismic events'
    },
    {
      name: 'Sensors',
      description: 'Manage seismic sensors'
    },
    
    {
      name: 'Auth',
      description: 'User management and authentication'
    },
    {
      name: 'Admin',
      description: 'User and Sensor nodes management'
    },
    {
      name: 'Events',
      description: 'Manage events'
    },
    // Add more groups as needed
  ]
};

const outputFile = './swagger-output.json';
// const endpointsFiles = ['./routes/amin.routes.js',
//   './routes/auth.routes.js','./routes/event.routes.js','./routes/felt.routes.js','./routes/sensor.routes.js'
// ];


const endpointsFiles = ['./routes/*.routes.js'
];
swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  require('./server.js'); 
});