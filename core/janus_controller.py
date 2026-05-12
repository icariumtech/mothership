"""
Orchestrates the JANUS AI workflow — the only place that coordinates
JanusSessionManager and JanusAI together.

Callers pass in a location_path (derived externally from active view state
or channel name) and get back a result dict. The four duplicated
orchestration blocks in views/janus.py are all instances of one of two
operations here.
"""
import uuid
from core.janus_session import JanusSessionManager, JanusMessage
from core.janus_ai import get_janus_ai


class JanusController:

    @staticmethod
    def submit_query(query: str, location_path: str | None, channel: str = 'default') -> dict:
        """
        Record a player query, generate an AI response, and queue it for GM approval.
        Returns {'query_id': str, 'pending_id': str}.
        """
        query_msg = JanusMessage(role='user', content=query)
        JanusSessionManager.add_message(query_msg, channel)

        ai = get_janus_ai(location_path=location_path)
        conversation = JanusSessionManager.get_conversation(channel)
        response = ai.generate_response(query, conversation)

        pending_id = JanusSessionManager.add_pending_response(
            query=query,
            response=response,
            query_id=query_msg.message_id,
            channel=channel,
        )
        return {'query_id': query_msg.message_id, 'pending_id': pending_id}

    @staticmethod
    def gm_generate(
        prompt: str,
        location_path: str | None,
        channel: str = 'default',
        context_override: str = '',
    ) -> dict:
        """
        Generate a JANUS response from a GM prompt and queue it for approval.
        Returns {'pending_id': str, 'response': str}.
        """
        ai = get_janus_ai(location_path=location_path)
        conversation = JanusSessionManager.get_conversation(channel)

        context_parts = [f"[GM CONTEXT: {prompt}]"]
        if context_override:
            context_parts.append(f"[GM CONTEXT OVERRIDE: {context_override}]")
        context_parts.append("\n\nGenerate a JANUS response based on this context.")
        context_prompt = "\n".join(context_parts)

        response = ai.generate_response(context_prompt, conversation)

        pending_id = JanusSessionManager.add_pending_response(
            query=f"[GM Prompt] {prompt}",
            response=response,
            query_id=str(uuid.uuid4()),
            channel=channel,
        )
        return {'pending_id': pending_id, 'response': response}
