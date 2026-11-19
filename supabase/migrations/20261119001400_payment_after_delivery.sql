-- =====================================================================
-- TapMenu — 1400 · Pagamento só depois da entrega
--
-- Regra de operação:
--   - O pedido nasce com pagamento "pendente" (já era assim: default
--     'pending'; pedir a conta passa a "a aguardar confirmação").
--   - Só pode ficar PAGO (ou CONFIRMADO) depois de o pedido estar
--     "Entregue" na mesa.
--
-- Aplicado na tabela orders (BEFORE UPDATE), por isso vale para todos os
-- caminhos: botão "Pago" em Pedidos, "Confirmar" em Pagamentos (o trigger
-- sync_order_from_payment atualiza o pedido e a transação é revertida),
-- ou UPDATE direto.
-- =====================================================================

create or replace function private.guard_payment_after_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status in ('paid', 'confirmed')
     and old.payment_status is distinct from new.payment_status
     and old.payment_status not in ('paid', 'confirmed')
     and new.status <> 'delivered' then
    raise exception 'Só pode marcar o pagamento como pago depois de o pedido % ser entregue na mesa.', new.order_code
      using errcode = 'P0001', hint = 'payment_before_delivery';
  end if;
  return new;
end;
$$;

create trigger guard_payment_after_delivery
  before update of payment_status, status on public.orders
  for each row execute function private.guard_payment_after_delivery();

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.can_receive_customer_topic(text) to anon;
