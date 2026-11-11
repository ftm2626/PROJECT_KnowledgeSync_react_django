from datetime import timedelta
from io import StringIO
from django.contrib.auth.models import User
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APITestCase
from .models import Topic, Vote

class LearningWorkflowTests(APITestCase):
    def setUp(self):
        self.alex = User.objects.create_user('alex', first_name='Alex')
        self.maya = User.objects.create_user('maya', first_name='Maya')
        self.topic = Topic.objects.create(title='Database indexes', description='Learn query plans', kind='REQUEST', proposer=self.alex, duration_minutes=30)

    def sign_in(self, user=None):
        response = self.client.post('/api/auth/login/', {'user_id': (user or self.alex).pk})
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + response.data['token'])

    def test_anonymous_read_and_write_permissions(self):
        response = self.client.get('/api/topics/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data[0]['has_voted'])
        for endpoint in ['vote', 'claim']:
            self.assertEqual(self.client.post(f'/api/topics/{self.topic.pk}/{endpoint}/').status_code, 401)
        self.assertEqual(self.client.post('/api/topics/', {}).status_code, 401)

    def test_identity_validation(self):
        self.assertEqual(self.client.post('/api/auth/login/', {}).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login/', {'user_id': 99999}).status_code, 400)
        self.assertEqual(len(self.client.get('/api/auth/users/').data), 2)
        self.sign_in()

    def test_offer_assigns_presenter_and_ignores_spoofed_fields(self):
        self.sign_in()
        response = self.client.post('/api/topics/', {'title': 'Python tricks', 'description': 'Useful techniques', 'kind': 'OFFER', 'duration_minutes': 15, 'status': 'COMPLETED', 'proposer': self.maya.pk, 'presenter': self.maya.pk})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['presenter']['id'], self.alex.pk)
        self.assertEqual(response.data['proposer']['id'], self.alex.pk)
        self.assertEqual(response.data['status'], 'PROPOSED')

    def test_validation_for_creation(self):
        self.sign_in()
        for payload in [dict(title=' ', description='x', kind='REQUEST', duration_minutes=30), dict(title='x', description='', kind='REQUEST', duration_minutes=30), dict(title='x', description='x', kind='INVALID', duration_minutes=30), dict(title='x', description='x', kind='OFFER', duration_minutes=0)]:
            self.assertEqual(self.client.post('/api/topics/', payload).status_code, 400)

    def test_vote_toggle_counts_and_personalization(self):
        self.sign_in()
        url = f'/api/topics/{self.topic.pk}/vote/'
        self.assertEqual(self.client.post(url).data, {'vote_count': 1, 'has_voted': True})
        self.assertTrue(self.client.get('/api/topics/').data[0]['has_voted'])
        self.sign_in(self.maya)
        self.assertFalse(self.client.get('/api/topics/').data[0]['has_voted'])
        self.assertEqual(self.client.post(url).data['vote_count'], 2)
        self.sign_in()
        self.assertEqual(self.client.post(url).data, {'vote_count': 1, 'has_voted': False})

    def test_unique_vote_constraint(self):
        Vote.objects.create(user=self.alex, topic=self.topic)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Vote.objects.create(user=self.alex, topic=self.topic)

    def test_full_request_claim_schedule_complete_lifecycle(self):
        self.sign_in(self.maya)
        base = f'/api/topics/{self.topic.pk}/'
        self.assertEqual(self.client.post(base + 'claim/').data['presenter']['id'], self.maya.pk)
        self.assertEqual(self.client.post(base + 'claim/').status_code, 400)
        scheduled = self.client.patch(base + 'schedule/', {'scheduled_at': (timezone.now()+timedelta(days=1)).isoformat(), 'duration_minutes': 45, 'meeting_link': 'https://example.com/meet'})
        self.assertEqual(scheduled.status_code, 200, scheduled.data)
        self.assertEqual(scheduled.data['status'], 'SCHEDULED')
        self.assertEqual(self.client.post(base + 'vote/').status_code, 400)
        self.assertEqual(self.client.patch(base + 'complete/', {'slides_url': 'https://example.com/slides'}).data['status'], 'COMPLETED')
        self.assertEqual(self.client.patch(base + 'complete/', {}).status_code, 400)
        self.assertEqual(self.client.patch(base + 'schedule/', {}).status_code, 400)

    def test_only_presenter_manages_session(self):
        self.topic.presenter = self.maya
        self.topic.save()
        self.sign_in(self.alex)
        for action in ['schedule', 'complete']:
            self.assertEqual(self.client.patch(f'/api/topics/{self.topic.pk}/{action}/', {}).status_code, 403)

    def test_invalid_scheduling_and_completion(self):
        self.topic.presenter = self.alex
        self.topic.save()
        self.sign_in()
        base = f'/api/topics/{self.topic.pk}/'
        for payload in [{}, {'scheduled_at': None, 'duration_minutes': 30}, {'scheduled_at': (timezone.now()-timedelta(days=1)).isoformat(), 'duration_minutes': 30}, {'scheduled_at': (timezone.now()+timedelta(days=1)).isoformat(), 'duration_minutes': 0}]:
            self.assertEqual(self.client.patch(base+'schedule/', payload, format='json').status_code, 400)
        self.assertEqual(self.client.patch(base+'complete/', {}).status_code, 400)
        self.topic.status = 'SCHEDULED'
        self.topic.save()
        self.assertEqual(self.client.patch(base+'complete/', {'slides_url':'javascript:alert(1)'}).status_code, 400)

    def test_offer_cannot_be_claimed_and_unclaimed_cannot_be_scheduled(self):
        self.sign_in()
        self.assertIn(self.client.patch(f'/api/topics/{self.topic.pk}/schedule/', {}).status_code, [400,403])
        self.topic.kind = 'OFFER'
        self.topic.save()
        self.assertEqual(self.client.post(f'/api/topics/{self.topic.pk}/claim/').status_code, 400)

    def test_search_filter_and_annotated_ordering(self):
        other = Topic.objects.create(title='React', description='Frontend', kind='OFFER', status='SCHEDULED', proposer=self.maya, presenter=self.maya)
        Vote.objects.create(user=self.alex, topic=other)
        self.assertEqual(self.client.get('/api/topics/').data[0]['id'], other.pk)
        self.assertEqual(len(self.client.get('/api/topics/?search=query&status=PROPOSED&kind=REQUEST').data), 1)
        self.assertEqual(len(self.client.get('/api/topics/?status=SCHEDULED').data), 1)
        self.assertEqual(self.client.get('/api/topics/?search=nothing').data, [])

    def test_seed_is_idempotent(self):
        call_command('seed_data', stdout=StringIO())
        counts = (User.objects.count(), Topic.objects.count(), Vote.objects.count())
        call_command('seed_data', stdout=StringIO())
        self.assertEqual(counts, (User.objects.count(), Topic.objects.count(), Vote.objects.count()))

    def test_cors_allows_lan_frontend(self):
        response = self.client.options('/api/topics/', HTTP_ORIGIN='http://192.168.1.42:5173', HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST')
        self.assertEqual(response['Access-Control-Allow-Origin'], '*')
