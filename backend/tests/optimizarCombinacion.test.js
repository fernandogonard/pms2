const { optimizarCombinacion } = require('../controllers/reservationController');

describe('optimizarCombinacion', () => {
  test('Selecciona la combinación con menos habitaciones', () => {
    const combinaciones = [
      [
        { id: 1, capacidad: 2 },
        { id: 2, capacidad: 3 }
      ],
      [
        { id: 3, capacidad: 5 }
      ]
    ];

    const resultado = optimizarCombinacion(combinaciones);
    expect(resultado).toEqual(combinaciones[1]);
  });

  test('Selecciona la combinación con menor fragmentación si hay empate', () => {
    const combinaciones = [
      [
        { id: 1, capacidad: 2 },
        { id: 2, capacidad: 3 }
      ],
      [
        { id: 3, capacidad: 4 },
        { id: 4, capacidad: 1 }
      ]
    ];

    const resultado = optimizarCombinacion(combinaciones);
    expect(resultado).toEqual(combinaciones[0]);
  });

  test('Devuelve vacío si no hay combinaciones', () => {
    const combinaciones = [];
    const resultado = optimizarCombinacion(combinaciones);
    expect(resultado).toEqual([]);
  });
});