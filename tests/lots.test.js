import {
  sortLotsFIFO,
  getSellableLotsFIFO,
  summarizeProductLots,
  allocateLotsForSale,
} from '../js/services/lots.js'

export function registerLotsTests(test, assert) {
  test('Lotes FIFO: ordena por fecha de entrada ascendente y desempata por vencimiento más próximo (FEFO)', () => {
    const lotes = [
      {
        id: 'l-3',
        codigo_lote: 'L-NUEVO',
        fecha_entrada: '2026-11-12',
        fecha_vencimiento: '2026-12-30',
        cantidad_disponible: 10,
        costo_unitario: 2200,
      },
      {
        id: 'l-2',
        codigo_lote: 'L-ANTIGUO-VENCE-TARDE',
        fecha_entrada: '2026-11-01',
        fecha_vencimiento: '2026-12-15',
        cantidad_disponible: 10,
        costo_unitario: 2000,
      },
      {
        id: 'l-1',
        codigo_lote: 'L-ANTIGUO-VENCE-ANTES',
        fecha_entrada: '2026-11-01',
        fecha_vencimiento: '2026-11-25',
        cantidad_disponible: 10,
        costo_unitario: 1950,
      },
    ]

    const sorted = sortLotsFIFO(lotes)
    assert(sorted[0].id === 'l-1', 'Sale primero el más antiguo que vence antes')
    assert(sorted[1].id === 'l-2', 'Sale segundo el de la misma entrada con vencimiento posterior')
    assert(sorted[2].id === 'l-3', 'Sale último el de entrada más reciente')
  })

  test('Lotes FIFO: bloquea lotes vencidos y deriva el stock disponible solo de lotes vigentes', () => {
    const hoy = '2026-11-13'
    const lotes = [
      {
        id: 'lot-exp',
        codigo_lote: 'L-VENCIDO',
        fecha_entrada: '2026-10-01',
        fecha_vencimiento: '2026-11-10', // vencido
        cantidad_disponible: 8,
        costo_unitario: 3000,
      },
      {
        id: 'lot-ok-1',
        codigo_lote: 'L-VIGENTE-1',
        fecha_entrada: '2026-11-05',
        fecha_vencimiento: '2026-11-20',
        cantidad_disponible: 6,
        costo_unitario: 3200,
      },
      {
        id: 'lot-ok-2',
        codigo_lote: 'L-VIGENTE-2',
        fecha_entrada: '2026-11-10',
        fecha_vencimiento: '2026-12-05',
        cantidad_disponible: 10,
        costo_unitario: 3400,
      },
    ]

    const sellable = getSellableLotsFIFO(lotes, hoy)
    assert(sellable.length === 2, 'Excluye el lote vencido')
    assert(sellable[0].id === 'lot-ok-1', 'El primer lote vendible es lot-ok-1')

    const summary = summarizeProductLots(lotes, hoy)
    assert(summary.cantidad_disponible === 16, 'Disponible para venta = 6 + 10 = 16')
    assert(summary.cantidad_vencida === 8, 'Stock vencido bloqueado = 8')
    assert(summary.proximo_lote.id === 'lot-ok-1', 'Próximo lote FIFO es lot-ok-1')
  })

  test('Lotes FIFO: asigna una venta tomando unidades de múltiples lotes en orden FIFO', () => {
    const hoy = '2026-11-13'
    const lotes = [
      {
        id: 'lot-a',
        codigo_lote: 'L-A',
        fecha_entrada: '2026-11-01',
        fecha_vencimiento: '2026-12-01',
        cantidad_disponible: 4,
        costo_unitario: 2000,
      },
      {
        id: 'lot-b',
        codigo_lote: 'L-B',
        fecha_entrada: '2026-11-08',
        fecha_vencimiento: '2026-12-20',
        cantidad_disponible: 10,
        costo_unitario: 2300,
      },
    ]

    const { allocations, updatedLots } = allocateLotsForSale(lotes, 7, hoy)
    assert(allocations.length === 2, 'Debe tomar de dos lotes para completar 7 unidades')
    assert(allocations[0].lote_id === 'lot-a' && allocations[0].cantidad_descontada === 4, 'Agota las 4 del lote A')
    assert(allocations[1].lote_id === 'lot-b' && allocations[1].cantidad_descontada === 3, 'Toma 3 del lote B')
    assert(updatedLots[0].cantidad_disponible === 0, 'Lote A queda en 0')
    assert(updatedLots[1].cantidad_disponible === 7, 'Lote B queda en 7')
  })
}
