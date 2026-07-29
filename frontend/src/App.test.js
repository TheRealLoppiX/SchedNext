import { render, screen } from '@testing-library/react';
import App from './App';

// Smoke test: em "/" (hostname localhost, sem slug de tenant) o App deve montar a Landing page
// sem quebrar. Trocado do teste padrão do Create React App ("renders learn react link"), que
// procurava um texto que não existe nesse projeto desde sempre.
test('renderiza a landing page na rota raiz', async () => {
  render(<App />);
  const logos = await screen.findAllByAltText('SchedNext');
  expect(logos.length).toBeGreaterThan(0);
});
