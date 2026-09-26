"""Router HTTP para el Agente Inteligente de Gestión Neiva.

Expone el endpoint delgado POST /api/agente/mensaje que delega toda la lógica
al AgentOrchestrator, validando la identidad del usuario y empresa mediante JWT.
"""

import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user, require_pro_entitlement
from app.services.agente.agent_orchestrator import AgentOrchestrator
from app.services.agente.intent_provider import LLMProviderUnavailableError
from app.services.agente.session_store import SessionStoreUnavailableError

router = APIRouter(prefix="/agente", tags=["Agente IA"])

# Instancia reutilizable del orquestador
_orchestrator = AgentOrchestrator()


class MensajeAgenteEntrada(BaseModel):
    mensaje: str = Field(..., min_length=1, description="Texto o comando del usuario")
    conversation_id: str | None = Field(None, description="ID de conversación opcional para contexto continuo")


class MensajeAgenteRespuesta(BaseModel):
    conversation_id: str
    estado: str
    respuesta: str
    datos: dict[str, Any] | None = None
    clarification: dict[str, Any] | None = None
    command_id: str | None = None
    preview: dict[str, Any] | None = None
    resultado: dict[str, Any] | None = None
    idempotente: bool = False


@router.post(
    "/mensaje",
    response_model=MensajeAgenteRespuesta,
    status_code=status.HTTP_200_OK,
    summary="Enviar mensaje al Agente Inteligente",
)
async def enviar_mensaje(
    payload: MensajeAgenteEntrada,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_pro_entitlement),
):
    """Procesa un comando en lenguaje natural, manteniendo sesión y FSM."""
    try:
        resultado = await _orchestrator.procesar_mensaje(
            mensaje=payload.mensaje,
            current_user=current_user,
            db=db,
            conversation_id=payload.conversation_id,
        )
        return resultado
    except SessionStoreUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de sesiones del agente está temporalmente no disponible. Intente de nuevo en unos segundos.",
        ) from exc
    except LLMProviderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "LLM_PROVIDER_UNAVAILABLE",
                "message": "El servicio de inteligencia artificial no se encuentra disponible en este momento. Por favor intente nuevamente.",
                "provider": exc.provider,
            },
        ) from exc


@router.post(
    "/transcribir-audio",
    status_code=status.HTTP_200_OK,
    summary="Transcribir fragmento de audio (fallback para navegadores móviles)",
)
async def transcribir_audio(
    audio: UploadFile = File(...),
    current_user: models.Usuario = Depends(require_pro_entitlement),
):
    """Fallback STT: recibe audio en formato Opus/WebM y devuelve el texto transcrito."""
    audio_bytes = await audio.read()
    print(
        "[VOICE-STT] AUDIO_RECEIVED",
        {
            "filename": audio.filename,
            "content_type": audio.content_type,
            "size": len(audio_bytes) if audio_bytes else 0,
        },
        flush=True,
    )

    if not audio_bytes or len(audio_bytes) < 100:
        print("[VOICE-STT] TRANSCRIPTION_RESULT", repr(""), flush=True)
        return {"texto": ""}

    text = ""

    # 1. Intentar con Groq Whisper si está disponible (ultra-rápido ~150ms)
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            transcription = client.audio.transcriptions.create(
                file=(audio.filename or "voz.webm", audio_bytes),
                model="whisper-large-v3",
                language="es",
            )
            text = transcription.text.strip()
            print("[VOICE-STT] TRANSCRIPTION_RESULT (Groq Whisper):", repr(text), flush=True)
            return {"texto": text}
        except Exception as exc:
            print("[VOICE-STT] ERROR en Groq Whisper:", exc, flush=True)
    else:
        print("[VOICE-STT] Groq no configurado (GROQ_API_KEY no presente)", flush=True)

    # 2. Fallback con Google Gemini (usando GOOGLE_API_KEY o GEMINI_API_KEY)
    google_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if google_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=google_key)
            gemini_model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
            model = genai.GenerativeModel(gemini_model_name)
            response = model.generate_content([
                "Transcribe de forma literal y exacta en español este audio de un tendero colombiano. Devuelve ÚNICAMENTE el texto transcrito, sin explicaciones ni comillas.",
                {"mime_type": audio.content_type or "audio/webm", "data": audio_bytes},
            ])
            text = (response.text or "").strip()
            print("[VOICE-STT] TRANSCRIPTION_RESULT (Google Gemini):", repr(text), flush=True)
            return {"texto": text}
        except Exception as exc:
            print("[VOICE-STT] ERROR en Google Gemini STT:", exc, flush=True)
    else:
        print("[VOICE-STT] Google Gemini no configurado (falta GOOGLE_API_KEY / GEMINI_API_KEY)", flush=True)

    print("[VOICE-STT] TRANSCRIPTION_RESULT", repr(text), flush=True)
    return {"texto": ""}
