import { describe, it, expect } from 'vitest';

// Função utilitária de validação idêntica à do frontend
const validatePassword = (pwd: string) => {
  return {
    length: pwd.length >= 8 && pwd.length <= 32,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
  };
};

describe('Validador de Senha Forte', () => {
  it('deve aceitar senhas fortes que atendem a todos os requisitos', () => {
    const result = validatePassword('SenhaTeste123!');
    expect(result.length).toBe(true);
    expect(result.uppercase).toBe(true);
    expect(result.lowercase).toBe(true);
    expect(result.number).toBe(true);
    expect(result.special).toBe(true);
    expect(Object.values(result).every(Boolean)).toBe(true);
  });

  it('deve rejeitar senhas curtas (menos de 8 caracteres)', () => {
    const result = validatePassword('S123!');
    expect(result.length).toBe(false);
  });

  it('deve rejeitar senhas sem letra maiúscula', () => {
    const result = validatePassword('senhateste123!');
    expect(result.uppercase).toBe(false);
  });

  it('deve rejeitar senhas sem letra minúscula', () => {
    const result = validatePassword('SENHATESTE123!');
    expect(result.lowercase).toBe(false);
  });

  it('deve rejeitar senhas sem números', () => {
    const result = validatePassword('SenhaTeste!');
    expect(result.number).toBe(false);
  });

  it('deve rejeitar senhas sem caracteres especiais', () => {
    const result = validatePassword('SenhaTeste123');
    expect(result.special).toBe(false);
  });
});
