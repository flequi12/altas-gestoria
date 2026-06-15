// Configuracion central, leida del entorno. Sin dependencias (no dotenv):
// en desarrollo se cargan vars con `node --env-file=.env` o desde el sistema.

export const config = {
  port: Number(process.env.PORT) || 3010,
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.EXTRACTION_MODEL || 'claude-opus-4-8',
    version: process.env.ANTHROPIC_VERSION || '2023-06-01',
    baseUrl: 'https://api.anthropic.com/v1/messages',
  },
};

export function iaConfigurada() {
  return Boolean(config.anthropic.apiKey);
}
