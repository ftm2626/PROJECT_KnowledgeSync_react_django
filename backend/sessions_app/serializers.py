from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers
from .models import Topic

class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ['id', 'username', 'name']
    def get_name(self, user):
        return user.get_full_name() or user.username

class TopicSerializer(serializers.ModelSerializer):
    proposer = UserSerializer(read_only=True)
    presenter = UserSerializer(read_only=True)
    vote_count = serializers.IntegerField(read_only=True, default=0)
    has_voted = serializers.BooleanField(read_only=True, default=False)
    title = serializers.CharField(max_length=200, allow_blank=False)
    description = serializers.CharField(allow_blank=False)
    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'kind', 'status', 'duration_minutes',
                  'proposer', 'presenter', 'scheduled_at', 'meeting_link', 'slides_url',
                  'created_at', 'updated_at', 'vote_count', 'has_voted']
        read_only_fields = ['status', 'scheduled_at', 'meeting_link', 'slides_url', 'created_at', 'updated_at']

class ScheduleSerializer(serializers.ModelSerializer):
    scheduled_at = serializers.DateTimeField(required=True, allow_null=False)
    duration_minutes = serializers.IntegerField(min_value=1, max_value=480, required=True)
    meeting_link = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    class Meta:
        model = Topic
        fields = ['scheduled_at', 'duration_minutes', 'meeting_link']
    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError('Choose a future date and time.')
        return value

class CompleteSerializer(serializers.ModelSerializer):
    slides_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    class Meta:
        model = Topic
        fields = ['slides_url']

class TopicEditSerializer(serializers.ModelSerializer):
    title = serializers.CharField(max_length=200, allow_blank=False)
    description = serializers.CharField(allow_blank=False)

    class Meta:
        model = Topic
        fields = ['title', 'description', 'kind', 'duration_minutes']

    def validate_kind(self, value):
        topic = self.instance
        if value != topic.kind:
            if topic.status != Topic.Status.PROPOSED:
                raise serializers.ValidationError('Topic type can only be changed before scheduling.')
            if topic.presenter_id and topic.presenter_id != topic.proposer_id:
                raise serializers.ValidationError('Topic type cannot be changed after a volunteer has claimed the idea.')
        return value
