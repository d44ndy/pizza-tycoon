import { describe, expect, it } from 'vitest';
import { format, formatInt, formatTime } from '../src/engine/format.ts';
import { D } from '../src/engine/decimal.ts';

describe('format', () => {
  it('affiche les petits nombres tels quels', () => {
    expect(format(0)).toBe('0');
    expect(format(15)).toBe('15');
    expect(format(0.1)).toBe('0,1');
    expect(format(999)).toBe('999');
  });

  it('utilise les suffixes de l’échelle courte en notation standard', () => {
    expect(format(1234)).toBe('1,23 K');
    expect(format(1_000_000)).toBe('1 M');
    expect(format(4_560_000_000)).toBe('4,56 Md');
    expect(format(D('7.89e12'))).toBe('7,89 Bn');
  });

  it('gère le passage de palier sans erreur d’arrondi', () => {
    expect(format(999_999)).toBe('1 M');
    expect(format(1000)).toBe('1 K');
  });

  it('propose les notations scientifique et ingénieur', () => {
    expect(format(D('1.23e45'), 'scientific')).toBe('1,23e45');
    expect(format(D('1.23e46'), 'engineering')).toBe('12,3e45');
    expect(format(D('1e45'), 'engineering')).toBe('1e45');
  });

  it('encaisse les nombres au-delà de 1e308', () => {
    expect(format(D('1e400'), 'scientific')).toBe('1e400');
    expect(format(D('1e400'))).toBe('1e400'); // hors table de suffixes -> scientifique
  });

  it('formate les entiers et les durées', () => {
    expect(formatInt(1234)).toBe('1 234');
    expect(formatTime(45)).toBe('45 s');
    expect(formatTime(135)).toBe('2 min 15 s');
    expect(formatTime(8000)).toBe('2 h 13 min');
    expect(formatTime(300000)).toBe('3 j 11 h');
  });
});
