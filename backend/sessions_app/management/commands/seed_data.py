from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from sessions_app.models import Topic, Vote

class Command(BaseCommand):
    help = 'Create reusable demo identities and realistic learning sessions (safe to rerun).'
    def handle(self, *args, **options):
        people = []
        for username, first, last in [('alex', 'Alex', 'Morgan'), ('maya', 'Maya', 'Chen'), ('sam', 'Sam', 'Rivera'), ('jordan', 'Jordan', 'Lee'), ('priya', 'Priya', 'Shah')]:
            user, created = User.objects.get_or_create(username=username, defaults={'first_name': first, 'last_name': last})
            if created:
                user.set_unusable_password()
                user.save()
            people.append(user)
        rows = [
            ('The art of a useful code review', 'Small habits that make pull requests easier to review, feedback kinder, and our code a little better. Bring your favorite review tip.', 'OFFER', 30, 0, 'PROPOSED', 4),
            ('Demystifying database indexes', 'What happens behind a fast query? A practical walkthrough of indexes, query plans, and the tradeoffs we make every day.', 'REQUEST', 45, 1, 'PROPOSED', 3),
            ('A calmer approach to debugging', 'From reproducing a slippery bug to testing your assumptions. A few techniques that help when the obvious fix does not work.', 'OFFER', 15, 2, 'PROPOSED', 2),
            ('Design systems for the rest of us', 'How can we share UI patterns without building a whole component library? Let’s explore a lightweight starting point.', 'REQUEST', 30, 3, 'PROPOSED', 2),
            ('Git beyond commit and push', 'Reflog, bisect, and interactive rebase: a guided tour of the tools that make Git feel like a safety net.', 'OFFER', 30, 4, 'SCHEDULED', 3),
            ('Making APIs a joy to use', 'A conversation about useful errors, predictable pagination, and the little details that make an API feel great.', 'OFFER', 45, 1, 'SCHEDULED', 4),
            ('Accessible interfaces, one small fix at a time', 'Keyboard navigation, focus states, and semantic HTML. Practical improvements from our own interfaces.', 'OFFER', 30, 3, 'COMPLETED', 4),
            ('Python typing in practice', 'A hands-on introduction to type hints, generics, and making your editor work harder for you.', 'OFFER', 30, 2, 'COMPLETED', 3),
        ]
        for i, (title, description, kind, duration, person, state, votes) in enumerate(rows):
            scheduled = timezone.now() + timedelta(days=i-3) if state == 'SCHEDULED' else timezone.now()-timedelta(days=10+i) if state == 'COMPLETED' else None
            topic, created = Topic.objects.get_or_create(title=title, defaults={
                'description': description, 'kind': kind, 'duration_minutes': duration,
                'proposer': people[person], 'presenter': people[person] if kind == 'OFFER' else None,
                'status': state, 'scheduled_at': scheduled,
                'meeting_link': 'https://meet.google.com/' if scheduled else '',
                'slides_url': 'https://docs.python.org/3/library/typing.html' if i == 7 else '',
            })
            if created:
                for user in people[:votes]:
                    Vote.objects.get_or_create(topic=topic, user=user)
        self.stdout.write(self.style.SUCCESS('Demo team and sessions are ready.'))
