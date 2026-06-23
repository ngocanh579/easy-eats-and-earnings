
REVOKE EXECUTE ON FUNCTION public._tx_wallet_delta(text, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_apply_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_apply_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_apply_delete() FROM PUBLIC, anon, authenticated;
