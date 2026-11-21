-- Fork-only. Deletes one account for the Stammtisch main site (service role only).
--
-- Our users sign in through the OTP handoff, so upstream's self-service account-delete function
-- (which demands an OAuth login within five minutes) can never serve them. The main site deletes
-- the tracker account instead, through POST /api/fork/account-delete, which calls this function.
--
-- It follows upstream's own SQL deletion path (private.retry_account_deletion and
-- private.delete_inactive_account): claim the job lease, hand populated owned teams to the oldest
-- member, drop team events and API accounting, delete the Auth user (all other user data cascades),
-- then complete the job. Everything runs in one transaction, so a failure leaves the account
-- untouched. Storage is not deployed on this instance, so there is no Storage ownership check.
CREATE FUNCTION private.fork_delete_account(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE v_claim record;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'p_user_id is required'; END IF;
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
  -- Unknown or already deleted: nothing to do, safe to repeat.
  IF NOT FOUND THEN RETURN jsonb_build_object('deleted', false, 'reason', 'not_found'); END IF;
  SELECT * INTO v_claim FROM public.claim_account_deletion_job(p_user_id, true);
  -- A live lease (user-requested or scheduled deletion in flight) stays with its owner.
  IF NOT COALESCE(v_claim.claimed, false) THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'claim_not_acquired', 'status', v_claim.status);
  END IF;
  PERFORM private.prepare_inactive_account_teams(p_user_id);
  DELETE FROM public.team_events WHERE initiated_by = p_user_id OR target_user = p_user_id;
  DELETE FROM public.api_usage_daily WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  UPDATE public.account_deletion_jobs SET status = 'completed', completed_at = clock_timestamp(),
    updated_at = clock_timestamp(), next_run_at = NULL, last_error = NULL, last_error_at = NULL,
    dead_lettered_at = NULL, claim_token = NULL,
    last_error_details = jsonb_build_object('reason', 'main_site_deletion')
  WHERE user_id = p_user_id AND claim_token = v_claim.claim_token;
  RETURN jsonb_build_object('deleted', true);
END;
$$;
REVOKE ALL ON FUNCTION private.fork_delete_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.fork_delete_account(uuid) TO service_role;

-- PostgREST only exposes public functions; the wrapper keeps the privileged body in `private`.
CREATE FUNCTION public.fork_delete_account(p_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.fork_delete_account(p_user_id);
$$;
REVOKE ALL ON FUNCTION public.fork_delete_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fork_delete_account(uuid) TO service_role;
COMMENT ON FUNCTION public.fork_delete_account(uuid) IS
  'Fork: deletes one account for the Stammtisch main site. Idempotent for unknown users; one transaction.';
