// Base URL da API, configurável por ambiente (ver .env.example). Em dev, cai no backend
// local por padrão; em produção, o Render injeta REACT_APP_API_URL no build.
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
