## Principios de animación (basados en Emil Kowalski)

Aplicar estas reglas por defecto en toda animación de UI. Orden = impacto.

### Easing (lo más importante)
- NUNCA usar `linear` para UI. Se siente robótico; nada en el mundo real se mueve a velocidad constante.
- Por defecto: `ease-out` para elementos que entran o responden a una acción del usuario (clic, hover). Hace que se sientan más rápidos.
- Usar `ease-in` solo para elementos que salen de pantalla.
- Preferir curvas cubic-bezier personalizadas sobre los keywords genéricos. Ejemplo de salida suave estilo iOS: `cubic-bezier(0.32, 0.72, 0, 1)`.

### Timing y duración
- Animaciones de UI por debajo de ~300ms. Feedback a una acción (modal, popover): 200ms o menos.
- Cuanto mayor el desplazamiento, algo más de duración; micro-movimientos = más cortos.
- La velocidad percibida importa más que la real: una curva ease-out rápida se siente instantánea.

### Qué propiedades animar
- Animar SOLO `transform` y `opacity` (corren en GPU, no causan reflow).
- NUNCA animar `width`, `height`, `top`, `left`, `margin` — causan jank.
- Para mover: `translate`. Para escalar: `scale`. Nunca `width/height`.

### Estrategia (cuándo NO animar)
- Si una animación no comunica algo (jerarquía, causa-efecto, continuidad), quitarla.
- No animar todo a la vez: usar orquestación / stagger para guiar la mirada.
- Una animación que el usuario ve 50 veces al día debe ser más sutil y rápida que una que ve una vez.

### Accesibilidad (no negociable)
- Respetar SIEMPRE `@media (prefers-reduced-motion: reduce)`: desactivar o reducir a un fade mínimo.
- Nunca animaciones que parpadeen o se repitan en loop de forma agresiva.