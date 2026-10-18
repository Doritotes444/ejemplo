# Checklist Pre-Vuelo de Calidad — Gestión Neiva

---

## ✈️ Fase 1: Antes de programar un nuevo endpoint o modelo
- [ ] ¿Identificaste la regla de negocio (`RN-xx`) que estás implementando?
- [ ] ¿La consulta o escritura incluye obligatoriamente el filtro `tenant_id`?
- [ ] Si estás en una transacción de venta, ¿los precios y nombres históricos se congelan en la línea de detalle?
- [ ] ¿Verificaste que no estás guardando totales derivados en tablas cabecera?
- [ ] ¿Estás usando la sesión asíncrona moderna `AsyncSession` (`get_async_db`) y no la sesión síncrona legada?

---

## 🛠️ Fase 2: Durante el desarrollo
- [ ] ¿Escribiste la prueba unitaria o de integración en `tests/` antes o a la par del código productivo?
- [ ] ¿Los nombres de métodos, variables y tablas están en inglés (`sales`, `products`, `tenants`)?
- [ ] ¿Los mensajes devueltos al usuario en la respuesta HTTP están en español correcto con tildes?
- [ ] ¿El nuevo endpoint maneja códigos de error semánticos (400, 401, 403, 404, 409, 422) con el formato estándar RFC 7807?

---

## 🏁 Fase 3: Antes de confirmar o cerrar sesión
- [ ] ¿Pasan todas las pruebas automáticas en verde?
  ```powershell
  .venv\Scripts\python.exe -m pytest tests/test_auth.py -v
  ```
- [ ] ¿El frontend compila sin errores?
  ```powershell
  cd frontend; npm run build; cd ..
  ```
- [ ] ¿Actualizaste `docs/traspaso/HANDOFF.md` reflejando el estado real y el siguiente paso?
