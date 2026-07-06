"""
Shared request plumbing for API views.

Every JSON POST endpoint used to hand-roll the same method guard and body
parsing; these decorators centralize that so handlers only contain their
actual logic. Responses match the legacy hand-rolled shapes exactly
(JSON error bodies, 405/400 statuses).
"""
import functools
import json

from django.http import JsonResponse


def post_only(view_func):
    """Reject non-POST requests with the standard JSON 405 response."""
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if request.method != 'POST':
            return JsonResponse({'error': 'Method not allowed'}, status=405)
        return view_func(request, *args, **kwargs)
    return wrapper


def post_json(view_func):
    """Enforce POST and parse request.body as JSON.

    The parsed body is passed to the view as its second positional
    argument: ``def view(request, data, ...)``.
    """
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if request.method != 'POST':
            return JsonResponse({'error': 'Method not allowed'}, status=405)
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        return view_func(request, data, *args, **kwargs)
    return wrapper
