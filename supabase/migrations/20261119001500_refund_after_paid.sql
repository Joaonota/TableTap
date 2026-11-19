-- =====================================================================
-- TapMenu — 1500 · Reembolso só depois de pago
--
-- Completa a migração 1400 (pagamento só depois da entrega):
--   - Só se pode marcar como REEMBOLSADO um pedido cujo pagamento já está
--     Pago (ou Confirmado). Nada para reembolsar num pagamento pendente.
--
-- Mesma função/trigger em orders (BEFORE UPDATE): vale para o botão
-- "Reembolsado" em Pedidos, "Reembolsar" em Pagamentos (o trigger
-- sync_order_from_payment atualiza o pedido e a transação é revertida)
-- ou UPDATE direto.
-- =====================================================================

create or replace function private.guard_payment_after_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1400: pago/confirmado só depois de o pedido ser entregue.
  if new.payment_status in ('paid', 'confirmed')
     and old.payment_status is distinct from new.payment_status
     and old.payment_status not in ('paid', 'confirmed')
     and new.status <> 'delivered' then
    raise exception 'Só pode marcar o pagamento como pago depois de o pedido % ser entregue na mesa.', new.order_code
      using errcode = 'P0001', hint = 'payment_before_delivery';
  end if;

  -- 1500: reembolso só de um pagamento já pago/confirmado.
  if new.payment_status = 'refunded'
     and old.payment_status is distinct from new.payment_status
     and old.payment_status not in ('paid', 'confirmed') then
    raise exception 'Só pode reembolsar o pedido % depois de o pagamento estar pago.', new.order_code
      using errcode = 'P0001', hint = 'refund_before_paid';
  end if;
  return new;
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.can_receive_customer_topic(text) to anon;
