from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

class Topic(models.Model):
    class Kind(models.TextChoices):
        OFFER = 'OFFER', 'I want to present this'
        REQUEST = 'REQUEST', 'I want to learn this'
    class Status(models.TextChoices):
        PROPOSED = 'PROPOSED', 'Open for voting'
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        COMPLETED = 'COMPLETED', 'Completed'
    title = models.CharField(max_length=200)
    description = models.TextField()
    kind = models.CharField(max_length=7, choices=Kind.choices)
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.PROPOSED)
    duration_minutes = models.PositiveIntegerField(default=30, validators=[MinValueValidator(1), MaxValueValidator(480)])
    proposer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='proposed_topics', on_delete=models.CASCADE)
    presenter = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name='presenting_topics', on_delete=models.SET_NULL)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    meeting_link = models.URLField(null=True, blank=True)
    slides_url = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self):
        return self.title

class Vote(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='votes', on_delete=models.CASCADE)
    topic = models.ForeignKey(Topic, related_name='votes', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('user', 'topic')
    def __str__(self):
        return f'{self.user} → {self.topic}'
