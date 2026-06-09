export interface AppConfig {
  port: number;
  openai: { apiKey: string; model: string };
  whatsapp: {
    verifyToken: string;
    accessToken: string;
    phoneNumberId: string;
    graphApiVersion: string;
    appSecret: string;
  };
  humanHandoffNumber: string;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    graphApiVersion: process.env.GRAPH_API_VERSION ?? 'v21.0',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  },
  humanHandoffNumber: process.env.HUMAN_HANDOFF_NUMBER ?? '',
});
