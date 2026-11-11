from django.contrib import admin
from .models import Topic, Vote
@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['title', 'kind', 'status', 'proposer', 'presenter', 'duration_minutes', 'scheduled_at']
    list_filter = ['kind', 'status', 'duration_minutes']
    search_fields = ['title', 'description', 'proposer__username', 'presenter__username']
    autocomplete_fields = ['proposer', 'presenter']
@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ['user', 'topic', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'topic__title']
