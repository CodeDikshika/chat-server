const corsOptions = {
  origin: 'https://chat-ui-kappa-two.vercel.app',
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  };
  const BESHRM_TOKEN = "Beshrm";
  
  export { corsOptions,BESHRM_TOKEN };