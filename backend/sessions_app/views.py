from django.contrib.auth import authenticate
from django.http import Http404
from django.db import transaction
from django.utils import timezone
from django.db.models import Count, Exists, OuterRef, Value, BooleanField, F
from rest_framework import mixins, viewsets, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from .models import Topic, Vote
from .serializers import TopicSerializer, UserSerializer, ScheduleSerializer, CompleteSerializer, TopicEditSerializer

class TopicViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = TopicSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'description', 'proposer__first_name', 'presenter__first_name']
    ordering_fields = ['vote_count', 'created_at', 'scheduled_at']
    ordering = ['-vote_count', '-created_at']

    def get_queryset(self):
        user = self.request.user
        voted = Exists(Vote.objects.filter(topic=OuterRef('pk'), user=user)) if user.is_authenticated else Value(False, output_field=BooleanField())
        qs = Topic.objects.select_related('proposer', 'presenter').annotate(vote_count=Count('votes'), has_voted=voted)
        for field in ['status', 'kind']:
            value = self.request.query_params.get(field)
            if value:
                qs = qs.filter(**{field: value})
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(proposer=user, presenter=user if serializer.validated_data['kind'] == Topic.Kind.OFFER else None)

    def updated_response(self, topic):
        topic = self.get_queryset().get(pk=topic.pk)
        return Response(self.get_serializer(topic).data)

    def require_creator(self, topic):
        if topic.proposer_id != self.request.user.id:
            raise PermissionDenied('Only the creator can edit or delete this idea.')

    def update(self, request, *args, **kwargs):
        try:
            topic_id = int(kwargs['pk'])
        except (ValueError, TypeError):
            raise Http404
        with transaction.atomic():
            # Acquire SQLite's write lock before checking presenter and lifecycle state.
            Topic.objects.filter(pk=topic_id).update(updated_at=F('updated_at'))
            topic = self.get_object()
            self.require_creator(topic)
            serializer = TopicEditSerializer(topic, data=request.data, partial=kwargs.get('partial', False))
            serializer.is_valid(raise_exception=True)
            changes = dict(serializer.validated_data)
            if changes.get('kind', topic.kind) != topic.kind:
                changes['presenter_id'] = topic.proposer_id if changes['kind'] == Topic.Kind.OFFER else None
            Topic.objects.filter(pk=topic.pk).update(**changes, updated_at=timezone.now())
            return self.updated_response(topic)

    def perform_destroy(self, instance):
        self.require_creator(instance)
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def vote(self, request, pk=None):
        with transaction.atomic():
            # Acquire a SQLite write lock before reading the vote state.
            Topic.objects.filter(pk=pk).update(updated_at=timezone.now())
            topic = self.get_object()
            if topic.status != Topic.Status.PROPOSED:
                raise ValidationError('Voting is open only for proposed topics.')
            vote, created = Vote.objects.get_or_create(user=request.user, topic=topic)
            if not created:
                vote.delete()
            return Response({'vote_count': topic.votes.count(), 'has_voted': created})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def claim(self, request, pk=None):
        topic = self.get_object()
        changed = Topic.objects.filter(pk=topic.pk, kind=Topic.Kind.REQUEST, status=Topic.Status.PROPOSED, presenter__isnull=True).update(presenter=request.user, updated_at=timezone.now())
        if not changed:
            raise ValidationError('Only an unclaimed, proposed request can be volunteered for.')
        return self.updated_response(topic)

    def require_presenter(self, topic):
        if topic.presenter_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('Only the presenter or an administrator can manage this session.')

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def schedule(self, request, pk=None):
        topic = self.get_object()
        self.require_presenter(topic)
        if not topic.presenter_id or topic.status != Topic.Status.PROPOSED:
            raise ValidationError('Assign a presenter to a proposed topic before scheduling.')
        serializer = ScheduleSerializer(topic, data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            changed = Topic.objects.filter(pk=topic.pk, status=Topic.Status.PROPOSED).update(**serializer.validated_data, status=Topic.Status.SCHEDULED, updated_at=timezone.now())
            if not changed:
                raise ValidationError('This topic has already changed. Refresh and try again.')
        return self.updated_response(topic)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def complete(self, request, pk=None):
        topic = self.get_object()
        self.require_presenter(topic)
        if topic.status != Topic.Status.SCHEDULED:
            raise ValidationError('Only scheduled sessions can be completed.')
        serializer = CompleteSerializer(topic, data=request.data)
        serializer.is_valid(raise_exception=True)
        Topic.objects.filter(pk=topic.pk, status=Topic.Status.SCHEDULED).update(**serializer.validated_data, status=Topic.Status.COMPLETED, updated_at=timezone.now())
        return self.updated_response(topic)

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(request=request, **serializer.validated_data)
    if user is None:
        return Response({'detail': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    request.auth.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
