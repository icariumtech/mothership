# terminal/migrations/0017_delete_activeview.py
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('terminal', '0016_add_encounter_active_portraits'),
    ]

    operations = [
        migrations.DeleteModel(
            name='ActiveView',
        ),
    ]
