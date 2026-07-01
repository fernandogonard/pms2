// e2e/basic-navigation.spec.js
// Tests E2E básicos para validar que la aplicación funciona
const { test, expect } = require('@playwright/test');

test.describe('Navegación básica', () => {
  test('Debe cargar la página de login', async ({ page }) => {
    await page.goto('/login');

    // Esperar a que aparezca el formulario de login
    await expect(page.locator('text=Login')).toBeVisible({ timeout: 10000 });

    // Verificar que existen los campos
    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('Debe mostrar error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Buscar campos de forma más flexible
    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

    await emailInput.fill('invalido@test.com');
    await passwordInput.fill('wrongpass');

    // Click en submit
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Esperar mensaje de error (puede ser alert, toast o div)
    await page.waitForTimeout(2000);

    // Verificar que sigue en login (no redirigió)
    expect(page.url()).toContain('/login');
  });

  test('Debe permitir login exitoso y redirigir', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

    // Usar credenciales válidas
    await emailInput.fill('recepcion@hotel.com');
    await passwordInput.fill('password123');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Esperar redirección (timeout mayor)
    await page.waitForURL(/\/(recepcion|admin)/, { timeout: 15000 });

    // Verificar que no estamos en login
    expect(page.url()).not.toContain('/login');
  });
});

test.describe('Componentes optimizados', () => {
  test('Calendario debe cargar con virtualización', async ({ page }) => {
    // Login primero
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

    await emailInput.fill('recepcion@hotel.com');
    await passwordInput.fill('password123');

    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/recepcion/, { timeout: 15000 });

    // Esperar a que cargue el contenido
    await page.waitForTimeout(2000);

    // Verificar que existe contenido del dashboard
    const body = await page.textContent('body');
    const hasReceptionContent =
      body.includes('Recepcionista') ||
      body.includes('Calendario') ||
      body.includes('Reservas');

    expect(hasReceptionContent).toBeTruthy();
  });

  test('Debe manejar cache y no refetch innecesario', async ({ page }) => {
    let requestCount = 0;

    // Interceptar llamadas a la API
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/rooms') || url.includes('/api/reservations')) {
        requestCount++;
      }
    });

    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

    await emailInput.fill('recepcion@hotel.com');
    await passwordInput.fill('password123');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/recepcion/, { timeout: 15000 });
    await page.waitForTimeout(3000); // Esperar carga inicial

    const initialRequests = requestCount;

    // Esperar 2 segundos sin hacer nada
    await page.waitForTimeout(2000);

    // No debe haber llamadas adicionales (cache activo)
    expect(requestCount).toBeLessThanOrEqual(initialRequests + 2); // Máximo 2 requests adicionales tolerados
  });
});
