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
        self.alex = User.objects.create_user('alex', password='Test-Only_Curiosity42!', first_name='Alex')
        self.maya = User.objects.create_user('maya', password='Test-Only_Curiosity42!', first_name='Maya')
        self.topic = Topic.objects.create(title='Database indexes', description='Learn query plans', kind='REQUEST', proposer=self.alex, duration_minutes=30)

    def sign_in(self, user=None):
        response = self.client.post('/api/auth/login/', {'username': (user or self.alex).username, 'password': 'Test-Only_Curiosity42!'})
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + response.data['token'])

    def test_anonymous_read_and_write_permissions(self):
        response = self.client.get('/api/topics/')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.get(f'/api/topics/{self.topic.pk}/').status_code, 401)
        self.assertEqual(self.client.get('/api/').status_code, 401)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 401)
        for action in ['schedule', 'complete']:
            self.assertEqual(self.client.patch(f'/api/topics/{self.topic.pk}/{action}/', {}).status_code, 401)
        for endpoint in ['vote', 'claim']:
            self.assertEqual(self.client.post(f'/api/topics/{self.topic.pk}/{endpoint}/').status_code, 401)
        self.assertEqual(self.client.post('/api/topics/', {}).status_code, 401)

    def test_identity_validation(self):
        self.assertEqual(self.client.post('/api/auth/login/', {}).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login/', {'user_id': 99999}).status_code, 400)
        self.assertEqual(self.client.get('/api/auth/users/').status_code, 404)
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
        self.sign_in()
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

    def test_credentials_required_and_password_is_not_trimmed(self):
        self.alex.set_password('  correct password  ')
        self.alex.save()
        valid = self.client.post('/api/auth/login/', {'username': 'alex', 'password': '  correct password  '})
        self.assertEqual(valid.status_code, 200)
        self.assertEqual(valid.data['user']['id'], self.alex.pk)
        self.assertNotIn('password', valid.data['user'])
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'alex', 'password': 'correct password'}).status_code, 401)

    def test_invalid_credentials_share_a_generic_error(self):
        inactive = User.objects.create_user('inactive', password='Test-Only_Curiosity42!', is_active=False)
        unusable = User.objects.create_user('unusable')
        for username, password in [('alex', 'wrong'), ('unknown', 'wrong'), (inactive.username, 'Test-Only_Curiosity42!'), (unusable.username, 'anything')]:
            response = self.client.post('/api/auth/login/', {'username': username, 'password': password})
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.data, {'detail': 'Invalid username or password.'})

    def test_current_user_and_server_logout(self):
        self.sign_in()
        token = self.client._credentials['HTTP_AUTHORIZATION']
        self.assertEqual(self.client.get('/api/auth/me/').data['id'], self.alex.pk)
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.assertEqual(self.client.get('/api/topics/').status_code, 401)
        self.sign_in()
        self.assertNotEqual(self.client._credentials['HTTP_AUTHORIZATION'], token)

    def test_login_ignores_stale_token_header(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token invalid-old-token')
        self.sign_in()
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)

    def test_staff_can_login_but_admin_session_does_not_authenticate_api(self):
        self.alex.is_staff = True
        self.alex.save()
        self.sign_in()
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        self.client.credentials()
        self.client.force_login(self.alex)
        self.assertEqual(self.client.get('/api/topics/').status_code, 401)

    def test_inactive_user_token_is_rejected(self):
        self.sign_in()
        self.alex.is_active = False
        self.alex.save()
        self.assertEqual(self.client.get('/api/topics/').status_code, 401)

    def test_mock_token_revocation_preserves_learning_data_and_passwords(self):
        from importlib import import_module
        from django.apps import apps
        from django.db import connection
        from rest_framework.authtoken.models import Token
        Token.objects.create(user=self.alex)
        Token.objects.create(user=self.maya)
        Vote.objects.create(user=self.alex, topic=self.topic)
        before = (User.objects.count(), Topic.objects.count(), Vote.objects.count())
        revoke = import_module('sessions_app.migrations.0002_revoke_mock_tokens').revoke_mock_tokens
        from types import SimpleNamespace
        revoke(apps, SimpleNamespace(connection=connection))
        self.assertEqual(Token.objects.count(), 0)
        self.assertEqual(before, (User.objects.count(), Topic.objects.count(), Vote.objects.count()))
        self.alex.refresh_from_db()
        self.assertTrue(self.alex.check_password('Test-Only_Curiosity42!'))


from django.test import override_settings

@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class CreatorManagementTests(APITestCase):
    def setUp(self):
        self.creator = User.objects.create_user('creator', password='test-pass')
        self.other = User.objects.create_user('other', password='test-pass', is_staff=True)
        self.topic = Topic.objects.create(title='Original idea', description='Original description', kind='OFFER', proposer=self.creator, presenter=self.creator, duration_minutes=30)
        Vote.objects.create(user=self.other, topic=self.topic)
        self.url = f'/api/topics/{self.topic.pk}/'
        self.client.force_authenticate(self.creator)

    def test_creator_can_edit_content_in_every_stage_without_losing_session_or_votes(self):
        for state in ['PROPOSED', 'SCHEDULED', 'COMPLETED']:
            self.topic.status = state
            self.topic.scheduled_at = timezone.now() + timedelta(days=1)
            self.topic.meeting_link = 'https://example.com/meet'
            self.topic.slides_url = 'https://example.com/slides'
            self.topic.save()
            original_time = self.topic.scheduled_at
            response = self.client.patch(self.url, {'title': 'Updated ' + state, 'description': 'Updated description', 'duration_minutes': 45, 'proposer': self.other.pk, 'presenter': self.other.pk, 'status': 'PROPOSED', 'meeting_link': 'https://other.example.com'})
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['vote_count'], 1)
            self.topic.refresh_from_db()
            self.assertEqual(self.topic.title, 'Updated ' + state)
            self.assertEqual(self.topic.description, 'Updated description')
            self.assertEqual(self.topic.duration_minutes, 45)
            self.assertEqual(self.topic.status, state)
            self.assertEqual(self.topic.proposer_id, self.creator.pk)
            self.assertEqual(self.topic.presenter_id, self.creator.pk)
            self.assertEqual(self.topic.scheduled_at, original_time)
            self.assertEqual(self.topic.meeting_link, 'https://example.com/meet')
            self.assertEqual(self.topic.slides_url, 'https://example.com/slides')

    def test_non_creator_cannot_edit_or_delete_even_if_staff_or_presenter(self):
        self.topic.presenter = self.other
        self.topic.save()
        self.client.force_authenticate(self.other)
        for method in [self.client.patch, self.client.put, self.client.delete]:
            response = method(self.url, {'title': 'Not yours'})
            self.assertEqual(response.status_code, 403)
        self.topic.refresh_from_db()
        self.assertEqual(self.topic.title, 'Original idea')
        self.assertEqual(self.topic.votes.count(), 1)

    def test_anonymous_cannot_edit_or_delete(self):
        self.client.force_authenticate(None)
        for method in [self.client.patch, self.client.put, self.client.delete]:
            self.assertEqual(method(self.url, {}).status_code, 401)

    def test_type_changes_update_presenter_while_preserving_votes(self):
        response = self.client.patch(self.url, {'kind': 'REQUEST'})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['presenter'])
        response = self.client.patch(self.url, {'kind': 'OFFER'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['presenter']['id'], self.creator.pk)
        self.assertEqual(response.data['vote_count'], 1)

    def test_type_cannot_change_after_claim_or_scheduling(self):
        self.topic.kind = 'REQUEST'
        self.topic.presenter = self.other
        self.topic.save()
        self.assertEqual(self.client.patch(self.url, {'kind': 'OFFER'}).status_code, 400)
        for state in ['SCHEDULED', 'COMPLETED']:
            self.topic.status = state
            self.topic.presenter = self.creator
            self.topic.save()
            self.assertEqual(self.client.patch(self.url, {'kind': 'OFFER'}).status_code, 400)
            self.assertEqual(self.client.patch(self.url, {'kind': 'REQUEST', 'title': 'Allowed content edit'}).status_code, 200)

    def test_invalid_edits_are_rejected_and_full_update_is_supported(self):
        for payload in [{'title': ' '}, {'description': ''}, {'duration_minutes': 0}, {'duration_minutes': 481}, {'kind': 'INVALID'}]:
            self.assertEqual(self.client.patch(self.url, payload).status_code, 400)
        self.assertEqual(self.client.put(self.url, {'title': 'New title', 'description': 'New description', 'kind': 'OFFER', 'duration_minutes': 60}).status_code, 200)
        self.assertEqual(self.client.patch('/api/topics/not-a-number/', {}).status_code, 404)
        self.assertEqual(self.client.delete('/api/topics/999999/').status_code, 404)

    def test_creator_delete_cascades_only_its_votes_in_all_stages(self):
        for state in ['PROPOSED', 'SCHEDULED', 'COMPLETED']:
            topic = Topic.objects.create(title=state, description='Delete test', kind='REQUEST', status=state, proposer=self.creator, presenter=self.other)
            Vote.objects.create(user=self.creator, topic=topic)
            response = self.client.delete(f'/api/topics/{topic.pk}/')
            self.assertEqual(response.status_code, 204)
            self.assertFalse(Topic.objects.filter(pk=topic.pk).exists())
            self.assertFalse(Vote.objects.filter(topic_id=topic.pk).exists())
        self.assertTrue(Topic.objects.filter(pk=self.topic.pk).exists())
        self.assertEqual(self.topic.votes.count(), 1)
        self.assertEqual(User.objects.count(), 2)
