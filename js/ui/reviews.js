/**
 * js/ui/reviews.js — Sistema de Reseñas Privado ("Muro de Reseñas")
 * Exclusivo para usuarios autenticados dentro de /app (nunca expuesto en la Landing pública).
 */

import { getPrivateReviewsLocal, createPrivateReviewLocal } from '../core/localStore.js'
import { getState, setState, showToast } from '../state.js'
import { icon } from './icons.js'

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderStarsHTML(rating) {
  const n = Math.min(5, Math.max(1, Math.round(Number(rating || 5))))
  let html = ''
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star-glyph ${i <= n ? 'star-filled' : 'star-empty'}">${icon('star', 14)}</span>`
  }
  return html
}

export function renderReviewsViewHTML(st) {
  if (!st.user) return ''

  const reviews = st.reviews || []
  const selectedRating = st.reviewDraftRating || 5
  const avg =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + Number(r.rating || 5), 0) / reviews.length).toFixed(1)
      : '5.0'

  const wallCardsHTML =
    reviews.length === 0
      ? `<div class="empty-state"><p class="empty-title">Sé el primero en publicar en el Muro de Reseñas privado</p></div>`
      : reviews
          .map((r) => {
            const dt = new Date(r.created_at).toLocaleString('es-CO', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
            return `
              <article class="review-wall-card">
                <div class="review-card-top">
                  <div class="review-author-block">
                    <div class="review-avatar">${escapeHTML(String(r.author_name || 'U')[0].toUpperCase())}</div>
                    <div>
                      <strong class="review-author-name">${escapeHTML(r.author_name)}</strong>
                      <div class="review-author-meta">
                        <span class="status-badge badge-neutral">${escapeHTML(r.author_role)}</span>
                        <span>·</span>
                        <span>${escapeHTML(r.store_name)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="review-stars-row" aria-label="Calificación ${r.rating} de 5">
                    ${renderStarsHTML(r.rating)}
                  </div>
                </div>

                <p class="review-comment-body">"${escapeHTML(r.comment)}"</p>

                <div class="review-card-footer">
                  <span class="review-category-pill">${escapeHTML(r.category || 'General')}</span>
                  <span class="review-date-text">${escapeHTML(dt)}</span>
                </div>
              </article>
            `
          })
          .join('')

  return `
    <section class="admin-section">
      <header class="section-header-bar">
        <div>
          <span class="status-tag">Comunidad Interna · Acceso Privado Autenticado</span>
          <h1 class="page-title">Muro de Reseñas de TiendApp</h1>
          <p class="page-subtitle">Espacio privado exclusivo para Dueños y Tenderos con sesión activa. Tus comentarios se almacenan localmente en IndexedDB.</p>
        </div>
        <div class="reviews-score-pill">
          <div class="score-big">${avg}</div>
          <div>
            <div class="review-stars-row">${renderStarsHTML(Math.round(Number(avg)))}</div>
            <small>${reviews.length} reseña(s) verificadas</small>
          </div>
        </div>
      </header>

      <div class="reviews-layout-grid">
        <!-- Formulario para dejar reseña -->
        <aside class="review-composer-card">
          <h2 class="subsection-title">Publicar Nueva Reseña</h2>
          <p class="page-subtitle">Comparte tu experiencia operativa con el POS, el lector de cámara o el control de lotes.</p>

          <form id="form-private-review" class="form-stack">
            <div class="form-field">
              <label>Calificación de tu experiencia *</label>
              <div class="interactive-stars-picker" id="review-star-picker">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (num) => `
                  <button
                    type="button"
                    class="star-pick-btn ${num <= selectedRating ? 'active' : ''}"
                    data-rate-star="${num}"
                    aria-label="${num} estrellas"
                  >
                    ${icon('star', 18)}
                    <span>${num}</span>
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="form-field">
              <label for="review-category">Módulo evaluado</label>
              <select id="review-category">
                <option value="Velocidad del POS">Velocidad del POS Mobile-First</option>
                <option value="Escáner de Cámara">Escáner de Código de Barras y Cámara</option>
                <option value="Control de Inventario">Control de Lotes FEFO/FIFO y Kardex</option>
                <option value="Diseño y Usabilidad">Diseño Minimalista y Modo Oscuro</option>
                <option value="General">Experiencia General TiendApp</option>
              </select>
            </div>

            <div class="form-field">
              <label for="review-comment">Tu reseña *</label>
              <textarea
                id="review-comment"
                rows="4"
                required
                minlength="4"
                placeholder="Escribe aquí cómo ha sido tu experiencia operando con TiendApp..."
              ></textarea>
            </div>

            <button type="submit" class="btn btn-primary btn-block" id="btn-submit-review">
              ${icon('message', 15)}
              <span>Publicar en el Muro Privado</span>
            </button>
          </form>
        </aside>

        <!-- Muro de Reseñas -->
        <div class="reviews-wall-column">
          <h2 class="subsection-title">Reseñas Publicadas en la Aplicación</h2>
          <div id="reviews-wall-grid" class="reviews-wall-grid">
            ${wallCardsHTML}
          </div>
        </div>
      </div>
    </section>
  `
}

export function bindReviewsViewEvents(root) {
  root.querySelectorAll('[data-rate-star]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-rate-star') || 5)
      setState({ reviewDraftRating: val })
    })
  })

  const form = root.querySelector('#form-private-review')
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const st = getState()
    const comment = root.querySelector('#review-comment')?.value.trim()
    const category = root.querySelector('#review-category')?.value || 'General'
    const rating = st.reviewDraftRating || 5

    try {
      await createPrivateReviewLocal({ comment, category, rating }, st.user)
      const updatedReviews = await getPrivateReviewsLocal()
      setState({
        reviews: updatedReviews,
        reviewDraftRating: 5,
      })
      showToast('ok', 'Tu reseña fue publicada en el Muro Privado.')
    } catch (err) {
      showToast('error', err.message || 'No se pudo publicar la reseña.')
    }
  })
}
