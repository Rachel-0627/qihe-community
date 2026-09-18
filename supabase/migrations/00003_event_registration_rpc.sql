CREATE OR REPLACE FUNCTION public.increment_event_registered(event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.events SET registered = registered + 1 WHERE id = event_id;
END; $$;

CREATE OR REPLACE FUNCTION public.decrement_event_registered(event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.events SET registered = GREATEST(registered - 1, 0) WHERE id = event_id;
END; $$;