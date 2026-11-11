from django.db import migrations


def revoke_mock_tokens(apps, schema_editor):
    Token = apps.get_model('authtoken', 'Token')
    Token.objects.using(schema_editor.connection.alias).all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('sessions_app', '0001_initial'),
        ('authtoken', '0004_alter_tokenproxy_options'),
    ]
    operations = [migrations.RunPython(revoke_mock_tokens, migrations.RunPython.noop)]
