# -*- coding: utf-8 -*-
"""Unit tests for provider models."""

from __future__ import annotations

import pytest

from wisecore.providers.models import (
    ProviderDefinition,
    ProviderSettings,
    CustomProviderData,
    ModelSlotConfig,
    ActiveModelsInfo,
)
from wisecore.providers.provider import ModelInfo


class TestModelInfo:
    """Tests for ModelInfo model."""

    def test_create_model_info(self):
        """Test creating a ModelInfo instance."""
        model = ModelInfo(
            id="gpt-4",
            name="GPT-4",
        )

        assert model.id == "gpt-4"
        assert model.name == "GPT-4"
        assert model.supports_multimodal is None
        assert model.supports_image is None
        assert model.supports_video is None

    def test_model_info_with_capabilities(self):
        """Test ModelInfo with capability flags."""
        model = ModelInfo(
            id="gpt-4-vision",
            name="GPT-4 Vision",
            supports_multimodal=True,
            supports_image=True,
            supports_video=False,
        )

        assert model.supports_multimodal is True
        assert model.supports_image is True
        assert model.supports_video is False

    def test_model_info_probe_source(self):
        """Test ModelInfo with probe source."""
        model = ModelInfo(
            id="claude-3",
            name="Claude 3",
            probe_source="documentation",
        )

        assert model.probe_source == "documentation"


class TestProviderDefinition:
    """Tests for ProviderDefinition model."""

    def test_create_provider_definition(self):
        """Test creating a ProviderDefinition."""
        provider = ProviderDefinition(
            id="openai",
            name="OpenAI",
            default_base_url="https://api.openai.com/v1",
        )

        assert provider.id == "openai"
        assert provider.name == "OpenAI"
        assert provider.default_base_url == "https://api.openai.com/v1"
        assert provider.is_custom is False
        assert provider.is_local is False
        assert provider.chat_model == "OpenAIChatModel"

    def test_provider_with_models(self):
        """Test ProviderDefinition with models."""
        models = [
            ModelInfo(id="gpt-4", name="GPT-4"),
            ModelInfo(id="gpt-3.5-turbo", name="GPT-3.5 Turbo"),
        ]

        provider = ProviderDefinition(
            id="openai",
            name="OpenAI",
            models=models,
        )

        assert len(provider.models) == 2
        assert provider.models[0].id == "gpt-4"

    def test_custom_provider(self):
        """Test custom provider flag."""
        provider = ProviderDefinition(
            id="custom",
            name="Custom Provider",
            is_custom=True,
        )

        assert provider.is_custom is True

    def test_local_provider(self):
        """Test local provider flag."""
        provider = ProviderDefinition(
            id="ollama",
            name="Ollama",
            is_local=True,
        )

        assert provider.is_local is True


class TestProviderSettings:
    """Tests for ProviderSettings model."""

    def test_default_settings(self):
        """Test default settings."""
        settings = ProviderSettings()

        assert settings.base_url == ""
        assert settings.api_key == ""
        assert settings.extra_models == []
        assert settings.chat_model == ""

    def test_settings_with_values(self):
        """Test settings with values."""
        settings = ProviderSettings(
            base_url="https://api.custom.com/v1",
            api_key="sk-test",
            chat_model="CustomChatModel",
        )

        assert settings.base_url == "https://api.custom.com/v1"
        assert settings.api_key == "sk-test"
        assert settings.chat_model == "CustomChatModel"

    def test_settings_with_extra_models(self):
        """Test settings with extra models."""
        extra_models = [
            ModelInfo(id="custom-model", name="Custom Model"),
        ]

        settings = ProviderSettings(extra_models=extra_models)

        assert len(settings.extra_models) == 1
        assert settings.extra_models[0].id == "custom-model"


class TestCustomProviderData:
    """Tests for CustomProviderData model."""

    def test_create_custom_provider(self):
        """Test creating custom provider data."""
        provider = CustomProviderData(
            id="my-custom",
            name="My Custom Provider",
        )

        assert provider.id == "my-custom"
        assert provider.name == "My Custom Provider"
        assert provider.default_base_url == ""
        assert provider.api_key == ""
        assert provider.chat_model == "OpenAIChatModel"

    def test_custom_provider_full_config(self):
        """Test custom provider with full configuration."""
        models = [ModelInfo(id="custom-1", name="Custom 1")]

        provider = CustomProviderData(
            id="my-custom",
            name="My Custom",
            default_base_url="https://api.custom.com",
            api_key_prefix="custom-",
            models=models,
            base_url="https://api.custom.com/v1",
            api_key="custom-key",
        )

        assert provider.default_base_url == "https://api.custom.com"
        assert provider.api_key_prefix == "custom-"
        assert provider.base_url == "https://api.custom.com/v1"
        assert provider.api_key == "custom-key"
        assert len(provider.models) == 1


class TestModelSlotConfig:
    """Tests for ModelSlotConfig model."""

    def test_default_slot_config(self):
        """Test default slot config."""
        slot = ModelSlotConfig()

        assert slot.provider_id == ""
        assert slot.model == ""

    def test_slot_config_with_values(self):
        """Test slot config with values."""
        slot = ModelSlotConfig(
            provider_id="openai",
            model="gpt-4",
        )

        assert slot.provider_id == "openai"
        assert slot.model == "gpt-4"


class TestActiveModelsInfo:
    """Tests for ActiveModelsInfo model."""

    def test_default_active_models(self):
        """Test default active models."""
        info = ActiveModelsInfo(active_llm=None)

        assert info.active_llm is None

    def test_active_models_with_slot(self):
        """Test active models with slot config."""
        slot = ModelSlotConfig(
            provider_id="openai",
            model="gpt-4",
        )

        info = ActiveModelsInfo(active_llm=slot)

        assert info.active_llm is not None
        assert info.active_llm.provider_id == "openai"
        assert info.active_llm.model == "gpt-4"
